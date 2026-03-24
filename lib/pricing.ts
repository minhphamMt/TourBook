export type TravelerCounts = {
  adults: number
  children: number
  infants: number
}

export type SchedulePrice = {
  travelerType: "adult" | "child" | "infant"
  price: number
  salePrice: number | null
}

export type CouponLike = {
  code: string
  discountType: "percentage" | "fixed_amount"
  discountValue: number
  minOrderAmount: number
  maxDiscountAmount: number | null
  isActive: boolean
  startAt: string | null
  endAt: string | null
}

export function getEffectivePrice(price: SchedulePrice) {
  return price.salePrice ?? price.price
}

export function computeSubtotal(counts: TravelerCounts, prices: SchedulePrice[]) {
  const priceMap = new Map(prices.map((price) => [price.travelerType, getEffectivePrice(price)]))

  return (
    counts.adults * (priceMap.get("adult") || 0) +
    counts.children * (priceMap.get("child") || 0) +
    counts.infants * (priceMap.get("infant") || 0)
  )
}

export function computeCouponDiscount(subtotal: number, coupon?: CouponLike | null) {
  if (!coupon || !coupon.isActive) return 0

  const now = new Date()
  const isStarted = !coupon.startAt || new Date(coupon.startAt) <= now
  const isNotExpired = !coupon.endAt || new Date(coupon.endAt) >= now

  if (!isStarted || !isNotExpired) return 0
  if (subtotal < coupon.minOrderAmount) return 0

  const rawDiscount =
    coupon.discountType === "percentage"
      ? subtotal * (coupon.discountValue / 100)
      : coupon.discountValue

  if (coupon.maxDiscountAmount == null) {
    return Math.max(0, Math.round(rawDiscount))
  }

  return Math.max(0, Math.round(Math.min(rawDiscount, coupon.maxDiscountAmount)))
}
