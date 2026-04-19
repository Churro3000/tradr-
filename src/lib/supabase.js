import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Products
export async function getProducts() {
  const { data } = await supabase.from('products').select('*').order('name')
  return data || []
}

export async function saveProduct(product) {
  const { error } = await supabase.from('products').upsert(product, { onConflict: 'barcode' })
  return error
}

export async function updateStock(id, newStock) {
  const { error } = await supabase.from('products').update({ stock: newStock }).eq('id', id)
  return error
}

// Sales
export async function saveSale(sale) {
  const { error } = await supabase.from('sales').insert(sale)
  return error
}

export async function getSales() {
  const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false })
  return data || []
}

// Discounts
export async function getDiscount(code) {
  const { data } = await supabase.from('discounts').select('*').eq('code', code.toUpperCase()).single()
  return data
}

// Purchases
export async function savePurchase(purchase) {
  const { error } = await supabase.from('purchases').insert(purchase)
  return error
}

export async function getPurchases() {
  const { data } = await supabase.from('purchases').select('*').order('created_at', { ascending: false })
  return data || []
}

// Quotations
export async function saveQuotation(quotation) {
  const { error } = await supabase.from('quotations').insert(quotation)
  return error
}

export async function getQuotations() {
  const { data } = await supabase.from('quotations').select('*').order('created_at', { ascending: false })
  return data || []
}

export async function updateQuotationStatus(id, status) {
  const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
  return error
}

// Suppliers
export async function getSuppliers() {
  const { data } = await supabase.from('suppliers').select('*').order('name')
  return data || []
}

export async function saveSupplier(supplier) {
  const { error } = await supabase
    .from('suppliers')
    .upsert(supplier, { onConflict: 'name' })
  return error
}