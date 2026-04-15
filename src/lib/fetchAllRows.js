export async function fetchAllRows(buildQuery, pageSize = 1000) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) throw error

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < pageSize) break
    from += pageSize
  }

  return rows
}
