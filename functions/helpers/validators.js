function validateAddCartData(items) {
  if (!Array.isArray(items)) {
    return { success: false, item: null, reason: 'INVALID_ARRAY' };
  }

  const badItem = items.find(item => {
    const count = Number(item?.count);
    return !Number.isInteger(count) || count <= 0;
  });

  if (!badItem) {
    return { success: true, item: null, reason: null };
  }

  const count = Number(badItem?.count);

  let reason;
  if (!Number.isFinite(count)) {
    reason = 'MISSING_OR_INVALID';
  } else if (!Number.isInteger(count)) {
    reason = 'NOT_INTEGER';
  } else if (count === 0) {
    reason = 'ZERO';
  } else {
    reason = 'NEGATIVE';
  }

  return {
    success: false,
    item: badItem,
    reason
  };
}

function normalizeCartRemoveReq(items, db) {
  // 1. Basic integrity check
  if (!Array.isArray(items) || !Array.isArray(db?.products)) {
    return [];
  }

  // 2. Build fast lookup
  const dbMap = new Map(
    db.products
      .filter(p => p?.productId && Number.isInteger(p.count))
      .map(p => [p.productId, p.count])
  );

  // 3. Process removals
  return items
    .map(item => {
      const dbCount = dbMap.get(item.productId);

      // FIX: If product doesn't exist in DB, return null so we can filter it out
      if (dbCount === undefined) return null;

      const requestedRemoveCount = Math.abs(Number(item.count) || 0);
      
      // Calculate negative delta: don't remove more than we have
      const finalDelta = -Math.min(requestedRemoveCount, dbCount);

      return {
        productId: item.productId,
        count: finalDelta
      };
    })
    .filter(Boolean); // 4. FIX: Remove the nulls (items not in DB)
}

module.exports = { validateAddCartData, normalizeCartRemoveReq }