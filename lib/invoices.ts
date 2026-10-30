import { sql } from "@/lib/db"
import { type Profile, withProfileDefaults } from "@/lib/profile"

// Files stored in the history. "xlsx" is accepted already; the form that
// generates spreadsheets comes later.
export const FILE_TYPES = {
  pdf: { contentType: "application/pdf", extensions: [".pdf"] },
  xlsx: {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: [".xlsx", ".xls"],
  },
} as const

export type FileType = keyof typeof FILE_TYPES


export type InvoiceItem = {
  project: string
  client: string
}

export type InvoiceRecord = {
  id: string
  invoiceNumber: string
  date: string
  year: number
  month: number
  total: string
  clientName: string
  notes: string
  paymentMethod: string
  fileType: FileType
  fileName: string
  blobUrl: string
  blobPath: string
  uploadedAt: string
  items: InvoiceItem[]
}

export type CatalogEntry = {
  id: number
  project: string
  client: string
  timesUsed: number
  lastUsedAt: string
}

export function detectFileType(file: File): FileType | null {
  const name = file.name.toLowerCase()
  for (const [type, spec] of Object.entries(FILE_TYPES) as [FileType, (typeof FILE_TYPES)[FileType]][]) {
    if (file.type === spec.contentType || spec.extensions.some((ext) => name.endsWith(ext))) {
      return type
    }
  }
  return null
}

export function cleanItems(items: unknown): InvoiceItem[] {
  if (!Array.isArray(items)) return []
  return items
    .map((i) => ({
      project: String(i?.project ?? i?.description ?? "").trim(),
      client: String(i?.client ?? "").trim(),
    }))
    .filter((i) => i.project || i.client)
}

const SELECT_INVOICES = `
  select
    i.id,
    i.invoice_number as "invoiceNumber",
    to_char(i.date, 'YYYY-MM-DD') as date,
    extract(year from i.date)::int as year,
    extract(month from i.date)::int as month,
    i.total,
    i.client_name as "clientName",
    i.notes,
    i.payment_method as "paymentMethod",
    i.file_type as "fileType",
    i.file_name as "fileName",
    i.blob_url as "blobUrl",
    i.blob_path as "blobPath",
    to_char(i.uploaded_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "uploadedAt",
    coalesce(
      (select json_agg(json_build_object('project', it.project, 'client', it.client) order by it.position)
       from invoice_items it where it.invoice_id = i.id),
      '[]'::json
    ) as items
  from invoices i
`

export async function listInvoices(): Promise<InvoiceRecord[]> {
  const rows = await sql.query(`${SELECT_INVOICES} order by i.date desc, i.uploaded_at desc`)
  return rows as InvoiceRecord[]
}

export async function getInvoice(id: string): Promise<InvoiceRecord | null> {
  const rows = await sql.query(`${SELECT_INVOICES} where i.id = $1`, [id])
  return (rows[0] as InvoiceRecord) ?? null
}

// Inserts (or replaces, on import) an invoice with its items and records the
// project/client pairs in the catalog, all in one transaction.
export async function saveInvoice(
  record: Omit<InvoiceRecord, "year" | "month">,
  { updateCatalog = true } = {},
) {
  const items = cleanItems(record.items)
  const queries = [
    sql`
      insert into invoices (id, invoice_number, date, total, client_name, notes, payment_method,
                            file_type, file_name, blob_url, blob_path, uploaded_at)
      values (${record.id}, ${record.invoiceNumber}, ${record.date}, ${record.total},
              ${record.clientName}, ${record.notes}, ${record.paymentMethod}, ${record.fileType},
              ${record.fileName}, ${record.blobUrl}, ${record.blobPath}, ${record.uploadedAt})
      on conflict (id) do update set
        invoice_number = excluded.invoice_number, date = excluded.date,
        total = excluded.total, client_name = excluded.client_name, notes = excluded.notes,
        payment_method = excluded.payment_method,
        file_type = excluded.file_type, file_name = excluded.file_name,
        blob_url = excluded.blob_url, blob_path = excluded.blob_path,
        uploaded_at = excluded.uploaded_at
    `,
    sql`delete from invoice_items where invoice_id = ${record.id}`,
    ...items.map(
      (item, position) => sql`
        insert into invoice_items (invoice_id, position, project, client)
        values (${record.id}, ${position}, ${item.project}, ${item.client})
      `,
    ),
    ...(updateCatalog ? items.flatMap((item) => catalogUpsertQueries(item)) : []),
  ]
  await sql.transaction(queries)
}

// countUse=false registers the pair (e.g. from a draft) without counting it
// as an invoice, so only finalized invoices raise times_used.
function catalogUpsertQueries(item: InvoiceItem, countUse = true) {
  if (!item.project || !item.client) return []
  const increment = countUse ? 1 : 0
  return [
    sql`insert into clients (name) values (${item.client}) on conflict (name) do nothing`,
    sql`
      insert into projects (name, client_id, times_used, last_used_at)
      select ${item.project}, id, ${increment}, now() from clients where name = ${item.client}
      on conflict (name, client_id) do update set
        times_used = projects.times_used + ${increment}, last_used_at = now()
    `,
  ]
}

export async function registerCatalogItems(items: unknown) {
  const queries = cleanItems(items).flatMap((item) => catalogUpsertQueries(item, false))
  if (queries.length > 0) await sql.transaction(queries)
}

export async function deleteInvoice(id: string): Promise<InvoiceRecord | null> {
  const record = await getInvoice(id)
  if (!record) return null
  await sql`delete from invoices where id = ${id}`
  return record
}

export async function listCatalog(): Promise<CatalogEntry[]> {
  const rows = await sql`
    select p.id, p.name as project, c.name as client,
           p.times_used as "timesUsed",
           to_char(p.last_used_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "lastUsedAt"
    from projects p join clients c on c.id = p.client_id
    order by p.last_used_at desc, p.times_used desc
  `
  return rows as CatalogEntry[]
}

export async function addCatalogEntry(item: InvoiceItem) {
  await sql.transaction(catalogUpsertQueries(item))
}

export async function deleteCatalogEntry(id: number) {
  await sql`delete from projects where id = ${id}`
  // Drop clients left without projects so they stop showing up as suggestions.
  await sql`delete from clients c where not exists (select 1 from projects p where p.client_id = c.id)`
}

export async function getSetting<T>(key: string): Promise<T | null> {
  const rows = await sql`select value from settings where key = ${key}`
  return (rows[0]?.value as T) ?? null
}

export async function setSetting(key: string, value: unknown) {
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `
}

export type Draft = {
  invoiceNumber: string
  data: Record<string, unknown>
  updatedAt: string
}

export async function listDrafts(): Promise<Draft[]> {
  const rows = await sql`
    select invoice_number as "invoiceNumber", data,
           to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
    from drafts order by updated_at desc
  `
  return rows as Draft[]
}

export async function saveDraft(invoiceNumber: string, data: unknown) {
  await sql`
    insert into drafts (invoice_number, data, updated_at)
    values (${invoiceNumber}, ${JSON.stringify(data)}::jsonb, now())
    on conflict (invoice_number) do update set data = excluded.data, updated_at = now()
  `
}

export async function deleteDraft(invoiceNumber: string) {
  await sql`delete from drafts where invoice_number = ${invoiceNumber}`
}

export type PaymentMethodLine = {
  label: string
  value: string
}

export type PaymentMethod = {
  id: number
  name: string
  lines: PaymentMethodLine[]
  isDefault: boolean
}

export function cleanPaymentMethod(body: unknown): { name: string; lines: PaymentMethodLine[] } | null {
  const b = body as { name?: unknown; lines?: unknown } | null
  const name = String(b?.name ?? "").trim()
  if (!name) return null
  const lines = (Array.isArray(b?.lines) ? b.lines : [])
    .map((l) => ({ label: String(l?.label ?? "").trim(), value: String(l?.value ?? "").trim() }))
    .filter((l) => l.label || l.value)
  return { name, lines }
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const rows = await sql`
    select id, name, lines, is_default as "isDefault"
    from payment_methods order by position, id
  `
  return rows as PaymentMethod[]
}

export async function createPaymentMethod(method: { name: string; lines: PaymentMethodLine[] }) {
  // The first method ever created becomes the default
  await sql`
    insert into payment_methods (name, lines, is_default, position)
    select ${method.name}, ${JSON.stringify(method.lines)}::jsonb,
           not exists (select 1 from payment_methods),
           coalesce(max(position) + 1, 0)
    from payment_methods
  `
}

export async function updatePaymentMethod(id: number, method: { name: string; lines: PaymentMethodLine[] }) {
  await sql`
    update payment_methods set name = ${method.name}, lines = ${JSON.stringify(method.lines)}::jsonb
    where id = ${id}
  `
}

export async function setDefaultPaymentMethod(id: number) {
  await sql`update payment_methods set is_default = (id = ${id})`
}

export async function deletePaymentMethod(id: number) {
  await sql.transaction([
    sql`delete from payment_methods where id = ${id}`,
    // Keep a default as long as any method is left
    sql`
      update payment_methods set is_default = true
      where id = (select id from payment_methods order by position, id limit 1)
        and not exists (select 1 from payment_methods where is_default)
    `,
  ])
}

const PROFILE_KEY = "profile"

export async function getProfile(): Promise<Profile> {
  return withProfileDefaults(await getSetting<Partial<Profile>>(PROFILE_KEY))
}

export async function saveProfile(profile: Profile) {
  await setSetting(PROFILE_KEY, profile)
}
