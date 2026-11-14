
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react'

import {
  CalendarDays,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tags,
  UtensilsCrossed,
} from 'lucide-react'

import {
  readMenuCatalog,
  refreshMenuCatalog,
  subscribeMenuCatalog,
} from '../../data/menuStore'

import {
  isOfferCurrentlyActive,
  readOffers,
  refreshOffers,
  subscribeOffers,
} from '../../data/offerStore'

import {
  loadAdminBookings,
  readRoomBookings,
  subscribeRoomBookings,
  type RoomBooking,
  type BookingStatus,
} from '../../data/bookingStore'

import type { MenuItem } from '../../data/menu'
import type { ZenOffer } from '../../data/offerStore'
import type { AdminPage } from '../AdminApp'

import StatCard from '../components/StatCard'

/* ==========================================
   ZEN CAFÉ — COMPACT ADMIN DASHBOARD
========================================== */

type Props = {
  onNavigate: (page: AdminPage) => void
  query: string
}

type ProductKind = 'all' | 'food' | 'drink'

const FALLBACK_IMAGE = '/assets/menu-panda-main.png'
const REFRESH_INTERVAL_MS = 30_000

const MAX_PRODUCTS = 3
const MAX_BOOKINGS = 3
const MAX_OFFERS = 3

/* ==========================================
   HELPERS
========================================== */

function fallbackImage(
  event: SyntheticEvent<HTMLImageElement>,
): void {
  const image = event.currentTarget

  if (!image.src.endsWith(FALLBACK_IMAGE)) {
    image.src = FALLBACK_IMAGE
  }
}

function productImage(image?: string): string {
  if (!image || image.startsWith('zen-menu-media:')) {
    return FALLBACK_IMAGE
  }

  return image
}

function bookingStatusClass(
  status: BookingStatus,
): string {
  switch (status) {
    case 'confirmed':
    case 'completed':
      return 'za-pill-green'

    case 'rejected':
    case 'cancelled':
      return 'za-pill-gray'

    case 'pending':
    case 'modification_proposed':
    default:
      return 'za-pill-amber'
  }
}

function bookingStatusLabel(
  status: BookingStatus,
): string {
  switch (status) {
    case 'pending':
      return 'Pending'
    case 'confirmed':
      return 'Confirmed'
    case 'rejected':
      return 'Rejected'
    case 'modification_proposed':
      return 'Modification Proposed'
    case 'cancelled':
      return 'Cancelled'
    case 'completed':
      return 'Completed'
    default:
      return status
  }
}

function formatBookingDate(value: string): string {
  if (!value) return '—'

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/,
  )

  if (!match) return value

  const [, year, month, day] = match

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
  )

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleDateString('en-LK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatBookingTime(value: string): string {
  if (!value) return '—'

  const match = value.match(/^(\d{1,2}):(\d{2})/)

  if (!match) return value

  const hours = Number(match[1])
  const minutes = match[2]

  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23
  ) {
    return value
  }

  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12

  return `${displayHours}:${minutes} ${period}`
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    error instanceof Error &&
    error.message.trim()
  ) {
    return error.message
  }

  return fallback
}

/* ==========================================
   SCOPED DASHBOARD STYLES

   These override the old tall dashboard
   table/card layout without affecting
   the dedicated Products or Bookings pages.
========================================== */

const compactDashboardStyles = `
  .za-dashboard .za-compact-panel {
    min-width: 0;
    align-self: start;
    overflow: hidden;
  }

  .za-dashboard .za-compact-panel .za-panel-head {
    margin-bottom: 16px;
  }

  .za-dashboard .za-compact-panel .za-panel-heading {
    min-width: 0;
  }

  .za-dashboard .za-compact-panel .za-panel-heading h2 {
    font-size: clamp(16px, 1.35vw, 21px);
    line-height: 1.25;
  }

  .za-dashboard .za-compact-panel .za-panel-heading h2 svg {
    width: 21px;
    height: 21px;
    flex-shrink: 0;
  }

  .za-dashboard .za-compact-panel .za-panel-heading p {
    font-size: 12px;
    line-height: 1.5;
  }

  .za-dashboard .za-compact-panel .za-primary {
    flex-shrink: 0;
  }

  .za-dashboard .za-compact-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-width: 0;
  }

  .za-dashboard .za-compact-row {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 11px 12px;
    min-width: 0;
    border: 1px solid #eee2d7;
    border-radius: 14px;
    background: #fffdfb;
    transition:
      background 180ms ease,
      border-color 180ms ease,
      transform 180ms ease,
      box-shadow 180ms ease;
  }

  .za-dashboard .za-compact-row:hover {
    background: #fff9f4;
    border-color: #e7c9b7;
    transform: translateY(-1px);
    box-shadow: 0 5px 16px rgba(80, 35, 15, 0.045);
  }

  .za-dashboard .za-compact-image {
    width: 49px;
    height: 49px;
    min-width: 49px;
    object-fit: cover;
    border-radius: 10px;
    background: #f5ece6;
  }

  .za-dashboard .za-compact-main {
    flex: 1;
    min-width: 0;
  }

  .za-dashboard .za-compact-title {
    display: block;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.5;
    color: #281b16;
  }

  .za-dashboard .za-compact-subtitle {
    display: block;
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    line-height: 1.45;
    color: #9b7d70;
  }

  .za-dashboard .za-compact-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px 9px;
    margin-top: 5px;
    font-size: 10.5px;
    color: #8b756b;
  }

  .za-dashboard .za-compact-meta span {
    min-width: 0;
  }

  .za-dashboard .za-compact-side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-shrink: 0;
    gap: 8px;
  }

  .za-dashboard .za-compact-side .za-pill {
    white-space: nowrap;
    font-size: 10px;
    padding: 5px 8px;
  }

  .za-dashboard .za-compact-icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 31px;
    height: 31px;
    flex-shrink: 0;
    border: 1px solid #eee0d5;
    border-radius: 50%;
    background: white;
    color: #a51b16;
    cursor: pointer;
    transition: background 160ms ease, color 160ms ease;
  }

  .za-dashboard .za-compact-icon-button:hover {
    background: #a51b16;
    color: white;
  }

  .za-dashboard .za-compact-booking {
    align-items: flex-start;
  }

  .za-dashboard .za-compact-booking-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 39px;
    height: 39px;
    min-width: 39px;
    border-radius: 11px;
    background: #fff0e8;
    color: #aa251b;
  }

  .za-dashboard .za-compact-booking .za-compact-side {
    align-self: center;
  }

  .za-dashboard .za-compact-booking .za-compact-title {
    white-space: normal;
    overflow-wrap: anywhere;
  }

  .za-dashboard .za-compact-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    margin-top: 13px;
    padding: 11px 14px;
    border: 1px solid #ead9ce;
    border-radius: 12px;
    background: #fffaf6;
    color: #a51b16;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 160ms ease,
      border-color 160ms ease;
  }

  .za-dashboard .za-compact-footer:hover {
    background: #fff0e8;
    border-color: #d8b7a3;
  }

  .za-dashboard .za-compact-footer svg {
    width: 15px;
    height: 15px;
  }

  .za-dashboard .za-compact-empty {
    padding: 24px 12px;
    text-align: center;
    color: #9b8174;
    font-size: 12px;
    border: 1px dashed #eaded5;
    border-radius: 12px;
  }

  .za-dashboard .za-compact-error {
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid #f0cfbf;
    border-radius: 10px;
    background: #fff7f3;
    color: #a3291e;
    font-size: 11px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .za-dashboard .za-compact-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 21px;
    height: 21px;
    padding: 0 6px;
    border-radius: 7px;
    background: #f8ebe3;
    color: #9c392a;
    font-size: 10px;
    font-weight: 700;
  }

  .za-dashboard .za-product-controls {
    margin-bottom: 14px;
  }

  .za-dashboard .za-compact-panel .za-offer-list {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .za-dashboard .za-compact-panel .za-offer {
    margin: 0;
    min-height: 0;
    padding: 10px;
    border: 1px solid #eee2d7;
    border-radius: 13px;
  }

  .za-dashboard .za-compact-panel .za-offer > img {
    width: 47px;
    height: 47px;
    flex-shrink: 0;
    object-fit: cover;
    border-radius: 9px;
  }

  .za-dashboard .za-compact-panel .za-offer-details {
    min-width: 0;
  }

  .za-dashboard .za-compact-panel .za-offer-details strong {
    font-size: 12px;
  }

  .za-dashboard .za-compact-panel .za-offer-details small {
    font-size: 10.5px;
  }

  .za-dashboard .za-compact-panel .za-offer .za-pill {
    font-size: 10px;
  }

  @media (max-width: 1300px) {
    .za-dashboard .za-compact-panel .za-panel-head {
      flex-wrap: wrap;
      gap: 10px;
    }

    .za-dashboard .za-compact-panel .za-primary {
      font-size: 11px;
    }

    .za-dashboard .za-compact-row {
      padding: 10px;
      gap: 8px;
    }

    .za-dashboard .za-compact-image {
      width: 42px;
      height: 42px;
      min-width: 42px;
    }
  }

  @media (max-width: 600px) {
    .za-dashboard .za-compact-panel {
      width: 100%;
    }

    .za-dashboard .za-compact-row {
      padding: 11px;
      gap: 9px;
    }

    .za-dashboard .za-compact-side {
      gap: 5px;
    }

    .za-dashboard .za-compact-side .za-pill {
      font-size: 9px;
      padding: 4px 6px;
    }

    .za-dashboard .za-compact-booking-icon {
      width: 34px;
      height: 34px;
      min-width: 34px;
    }

    .za-dashboard .za-compact-icon-button {
      width: 29px;
      height: 29px;
    }

    .za-dashboard .za-compact-meta {
      font-size: 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .za-dashboard .za-compact-row,
    .za-dashboard .za-compact-footer,
    .za-dashboard .za-compact-icon-button {
      transition: none;
      transform: none;
    }
  }
`

/* ==========================================
   MAIN COMPONENT
========================================== */

export default function Dashboard({
  onNavigate,
  query,
}: Props) {
  const [products, setProducts] =
    useState<MenuItem[]>(() => readMenuCatalog())

  const [offers, setOffers] =
    useState<ZenOffer[]>(() => readOffers())

  const [bookings, setBookings] =
    useState<RoomBooking[]>([])

  const [bookingsLoaded, setBookingsLoaded] =
    useState(false)

  const [kind, setKind] =
    useState<ProductKind>('all')

  const [productSearch, setProductSearch] =
    useState('')

  const [refreshing, setRefreshing] =
    useState(false)

  const [bookingError, setBookingError] =
    useState('')

  const [offerError, setOfferError] =
    useState('')

  const [productError, setProductError] =
    useState('')

  const mountedRef = useRef(false)
  const refreshInProgressRef = useRef(false)
  const refreshQueuedRef = useRef(false)
  const refreshGenerationRef = useRef(0)

  /* ========================================
     STORE SYNCHRONIZATION
  ======================================== */

  const syncCatalog = useCallback(() => {
    if (!mountedRef.current) return

    setProducts(readMenuCatalog())
    setOffers(readOffers())
  }, [])

  /* ========================================
     REFRESH DATA

     Preserve the existing bookingStore
     API and authentication handling.
  ======================================== */

  const refreshDashboard =
    useCallback(async (): Promise<void> => {
      if (refreshInProgressRef.current) {
        refreshQueuedRef.current = true
        return
      }

      refreshInProgressRef.current = true

      const generation =
        refreshGenerationRef.current

      if (mountedRef.current) {
        setRefreshing(true)
      }

      try {
        syncCatalog()

        const [
          productsResult,
          offersResult,
          bookingsResult,
        ] = await Promise.allSettled([
          refreshMenuCatalog({
            all: true,
            force: true,
          }),
          refreshOffers(true),
          loadAdminBookings(),
        ])

        if (
          !mountedRef.current ||
          generation !== refreshGenerationRef.current
        ) {
          return
        }

        if (productsResult.status === 'fulfilled') {
          setProducts(productsResult.value)
          setProductError('')
        } else {
          setProductError(
            getErrorMessage(
              productsResult.reason,
              'Unable to synchronize products.',
            ),
          )

          console.error(
            '[Zen Café Dashboard] Products:',
            productsResult.reason,
          )
        }

        if (offersResult.status === 'fulfilled') {
          setOffers(offersResult.value)
          setOfferError('')
        } else {
          setOfferError(
            getErrorMessage(
              offersResult.reason,
              'Unable to synchronize offers.',
            ),
          )

          console.error(
            '[Zen Café Dashboard] Offers:',
            offersResult.reason,
          )
        }

        if (bookingsResult.status === 'fulfilled') {
          setBookings(bookingsResult.value)
          setBookingsLoaded(true)
          setBookingError('')
        } else {
          setBookingError(
            getErrorMessage(
              bookingsResult.reason,
              'Unable to load room bookings.',
            ),
          )

          console.error(
            '[Zen Café Dashboard] Bookings:',
            bookingsResult.reason,
          )
        }
      } finally {
        refreshInProgressRef.current = false

        if (
          mountedRef.current &&
          generation === refreshGenerationRef.current
        ) {
          setRefreshing(false)

          if (refreshQueuedRef.current) {
            refreshQueuedRef.current = false
            void refreshDashboard()
          }
        }
      }
    }, [syncCatalog])

  /* ========================================
     SUBSCRIPTIONS AND AUTO REFRESH
  ======================================== */

  useEffect(() => {
    mountedRef.current = true
    refreshGenerationRef.current += 1

    const stopMenu = subscribeMenuCatalog(() => {
      if (!mountedRef.current) return

      setProducts(readMenuCatalog())
    })

    const stopOffers = subscribeOffers(() => {
      if (!mountedRef.current) return

      setOffers(readOffers())
    })

    const stopBookings = subscribeRoomBookings(() => {
      if (!mountedRef.current) return

      setBookings(readRoomBookings())
      setBookingsLoaded(true)
    })

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard()
      }
    }

    const handleStorage = () => {
      syncCatalog()
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorage)

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    )

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshDashboard()
      }
    }, REFRESH_INTERVAL_MS)

    void refreshDashboard()

    return () => {
      mountedRef.current = false
      refreshGenerationRef.current += 1
      refreshQueuedRef.current = false

      stopMenu()
      stopOffers()
      stopBookings()

      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorage)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      )

      window.clearInterval(interval)
    }
  }, [refreshDashboard, syncCatalog])

  /* ========================================
     FILTERING
  ======================================== */

  const globalTerm = query.trim().toLowerCase()
  const localTerm = productSearch.trim().toLowerCase()

  const matchingProducts = useMemo(() => {
    return products.filter(product => {
      const matchesKind =
        kind === 'all' || product.kind === kind

      const searchableText = [
        product.name,
        product.category,
        product.description || '',
      ]
        .join(' ')
        .toLowerCase()

      return (
        matchesKind &&
        (!globalTerm ||
          searchableText.includes(globalTerm)) &&
        (!localTerm ||
          searchableText.includes(localTerm))
      )
    })
  }, [products, kind, globalTerm, localTerm])

  const filteredProducts = useMemo(
    () => matchingProducts.slice(0, MAX_PRODUCTS),
    [matchingProducts],
  )

  const matchingOffers = useMemo(() => {
    return offers.filter(offer => {
      const searchableText = [
        offer.title,
        offer.subtitle || '',
        offer.description || '',
      ]
        .join(' ')
        .toLowerCase()

      return (
        !globalTerm ||
        searchableText.includes(globalTerm)
      )
    })
  }, [offers, globalTerm])

  const filteredOffers = useMemo(
    () => matchingOffers.slice(0, MAX_OFFERS),
    [matchingOffers],
  )

  const matchingBookings = useMemo(() => {
    return bookings.filter(booking => {
      const searchableText = [
        booking.customerName,
        booking.email,
        booking.phone,
        booking.roomName,
        booking.bookingDate,
        booking.bookingTime,
        booking.status,
      ]
        .join(' ')
        .toLowerCase()

      return (
        !globalTerm ||
        searchableText.includes(globalTerm)
      )
    })
  }, [bookings, globalTerm])

  const filteredBookings = useMemo(
    () => matchingBookings.slice(0, MAX_BOOKINGS),
    [matchingBookings],
  )

  /* ========================================
     DASHBOARD STATISTICS
  ======================================== */

  const totalProducts = products.length

  const activeOffers = useMemo(() => {
    return offers.filter(offer =>
      isOfferCurrentlyActive(offer),
    ).length
  }, [offers])

  const totalBookings = bookings.length

  /* ========================================
     RENDER
  ======================================== */

  return (
    <div className="za-dashboard">
      <style>{compactDashboardStyles}</style>

      {/* ====================================
          HERO BANNER
      ==================================== */}

      <section className="za-hero">
        <div className="za-hero-copy">
          <p className="za-kicker">
            WELCOME BACK
          </p>

          <h1 className="za-hero-title">
            Zen Café Admin

            <span
              className="za-hero-sparkles"
              aria-hidden="true"
            >
              <span>✦</span>
              <span>✦</span>
            </span>
          </h1>

          <p className="za-hero-description">
            Manage your menu, offers and room bookings
            with ease.
          </p>
        </div>

        <div
          className="za-hero-art"
          aria-label="Great Food, Happier Moments"
        >
          <div className="za-hero-handwriting">
            <span>Great Food</span>
            <span>Happier</span>
            <span>
              Moments <b>♥</b>
            </span>
          </div>
        </div>
      </section>

      {/* ====================================
          STATISTICS
      ==================================== */}

      <section
        className="za-stats"
        aria-label="Dashboard overview"
      >
        <StatCard
          title="MENU ITEMS"
          value={totalProducts}
          subtitle={
            productError
              ? 'Last loaded products'
              : 'Total products'
          }
          icon={UtensilsCrossed}
          tone="rose"
          onClick={() => onNavigate('products')}
        />

        <StatCard
          title="ACTIVE OFFERS"
          value={activeOffers}
          subtitle={
            offerError
              ? 'Last loaded offers'
              : 'Live promotions'
          }
          icon={Tags}
          tone="amber"
          onClick={() => onNavigate('offers')}
        />

        <StatCard
          title="ROOM BOOKINGS"
          value={totalBookings}
          subtitle={
            bookingError
              ? bookingsLoaded
                ? 'Last loaded requests'
                : 'Bookings unavailable'
              : bookingsLoaded
                ? 'Total requests'
                : 'Loading requests'
          }
          icon={CalendarDays}
          tone="green"
          onClick={() => onNavigate('bookings')}
        />
      </section>

      {/* ====================================
          MANAGEMENT PANELS
      ==================================== */}

      <section className="za-panels">

        {/* ==================================
            COMPACT MENU / PRODUCTS
        ================================== */}

        <article className="za-panel za-products-panel za-compact-panel">
          <div className="za-panel-head">
            <div className="za-panel-heading">
              <h2>
                <UtensilsCrossed />
                <span>Menu / Products</span>
              </h2>

              <p>
                Manage your café menu items.
              </p>
            </div>

            <button
              type="button"
              className="za-primary"
              onClick={() => onNavigate('add-product')}
            >
              <Plus size={16} />
              Add Product
            </button>
          </div>

          <div className="za-product-controls">
            <div
              className="za-filter-pills"
              aria-label="Filter products"
            >
              {(
                ['all', 'food', 'drink'] as const
              ).map(value => (
                <button
                  key={value}
                  type="button"
                  className={
                    kind === value ? 'active' : ''
                  }
                  onClick={() => setKind(value)}
                  aria-pressed={kind === value}
                >
                  {value === 'all'
                    ? 'All'
                    : value === 'food'
                      ? 'Food'
                      : 'Drinks'}
                </button>
              ))}
            </div>

            <label className="za-product-search">
              <Search size={15} />

              <input
                type="search"
                value={productSearch}
                onChange={event =>
                  setProductSearch(event.target.value)
                }
                placeholder="Search products..."
                aria-label="Search products"
              />
            </label>
          </div>

          <div className="za-compact-list">
            {filteredProducts.map(product => (
              <div
                className="za-compact-row"
                key={product.id}
              >
                <img
                  className="za-compact-image"
                  src={productImage(product.image)}
                  alt={product.name}
                  onError={fallbackImage}
                  loading="lazy"
                />

                <div className="za-compact-main">
                  <strong className="za-compact-title">
                    {product.name}
                  </strong>

                  <span className="za-compact-subtitle">
                    {product.category || 'Menu item'}
                  </span>

                  <div className="za-compact-meta">
                    <span>
                      {product.kind === 'drink'
                        ? 'Drink'
                        : 'Food'}
                    </span>
                  </div>
                </div>

                <div className="za-compact-side">
                  <span
                    className={`za-pill ${
                      product.available
                        ? 'za-pill-green'
                        : 'za-pill-gray'
                    }`}
                  >
                    {product.available
                      ? 'Active'
                      : 'Hidden'}
                  </span>

                  <button
                    type="button"
                    className="za-compact-icon-button"
                    title={`Manage ${product.name}`}
                    aria-label={`Manage ${product.name}`}
                    onClick={() => onNavigate('products')}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            ))}

            {filteredProducts.length === 0 && (
              <div className="za-compact-empty">
                No matching products found.
              </div>
            )}
          </div>

          {productError && (
            <div
              className="za-compact-error"
              role="alert"
            >
              Products synchronization error:{' '}
              {productError}
            </div>
          )}

          <button
            type="button"
            className="za-compact-footer"
            onClick={() => onNavigate('products')}
          >
            <span>View All Products</span>

            <span className="za-compact-count">
              {matchingProducts.length}
            </span>

            <ChevronRight />
          </button>
        </article>

        {/* ==================================
            COMPACT OFFERS & PROMOTIONS
        ================================== */}

        <article className="za-panel za-offers-panel za-compact-panel">
          <div className="za-panel-head">
            <div className="za-panel-heading">
              <h2>
                <Tags />
                <span>Offers &amp; Promotions</span>
              </h2>

              <p>
                Manage your active promotions.
              </p>
            </div>

            <button
              type="button"
              className="za-primary"
              onClick={() => onNavigate('offers')}
            >
              <Plus size={16} />
              Add Offer
            </button>
          </div>

          <div className="za-offer-list">
            {filteredOffers.map(offer => {
              const isActive =
                isOfferCurrentlyActive(offer)

              return (
                <div
                  className="za-offer"
                  key={offer.id}
                >
                  <img
                    src={offer.image || FALLBACK_IMAGE}
                    alt={offer.title}
                    onError={fallbackImage}
                    loading="lazy"
                  />

                  <div className="za-offer-details">
                    <strong>{offer.title}</strong>

                    <small>
                      {offer.subtitle ||
                        'Special café offer'}
                    </small>
                  </div>

                  <span
                    className={`za-pill ${
                      isActive
                        ? 'za-pill-green'
                        : 'za-pill-gray'
                    }`}
                  >
                    {isActive
                      ? 'Active'
                      : 'Inactive'}
                  </span>

                  <button
                    type="button"
                    className="za-offer-more"
                    aria-label={`Manage ${offer.title}`}
                    onClick={() => onNavigate('offers')}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </div>
              )
            })}

            {filteredOffers.length === 0 && (
              <div className="za-compact-empty">
                No matching offers found.
              </div>
            )}
          </div>

          {offerError && (
            <div
              className="za-compact-error"
              role="alert"
            >
              Offers synchronization error:{' '}
              {offerError}
            </div>
          )}

          <button
            type="button"
            className="za-compact-footer"
            onClick={() => onNavigate('offers')}
          >
            <span>View All Offers</span>

            <span className="za-compact-count">
              {matchingOffers.length}
            </span>

            <ChevronRight />
          </button>
        </article>

        {/* ==================================
            COMPACT ROOM BOOKINGS
        ================================== */}

        <article className="za-panel za-bookings-panel za-compact-panel">
          <div className="za-panel-head">
            <div className="za-panel-heading">
              <h2>
                <CalendarDays />
                <span>Room Bookings</span>
              </h2>

              <p>
                Latest booking requests.
              </p>
            </div>

            <button
              type="button"
              className="za-compact-icon-button"
              title="Refresh dashboard"
              aria-label="Refresh dashboard data"
              disabled={refreshing}
              onClick={() => {
                void refreshDashboard()
              }}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ? 'animate-spin' : ''
                }
              />
            </button>
          </div>

          {bookingError && (
            <div
              className="za-compact-error"
              role="alert"
            >
              {bookingError}

              <button
                type="button"
                className="za-compact-footer"
                disabled={refreshing}
                onClick={() => {
                  void refreshDashboard()
                }}
              >
                <RefreshCw
                  size={14}
                  className={
                    refreshing ? 'animate-spin' : ''
                  }
                />

                {refreshing
                  ? 'Retrying...'
                  : 'Retry Loading Bookings'}
              </button>
            </div>
          )}

          <div className="za-compact-list">
            {filteredBookings.map(booking => (
              <div
                className="za-compact-row za-compact-booking"
                key={booking.id}
              >
                <div className="za-compact-booking-icon">
                  <CalendarDays size={19} />
                </div>

                <div className="za-compact-main">
                  <strong className="za-compact-title">
                    {booking.customerName || 'Customer'}
                  </strong>

                  <span className="za-compact-subtitle">
                    {formatBookingDate(
                      booking.bookingDate,
                    )}
                    {' · '}
                    {formatBookingTime(
                      booking.bookingTime ||
                        booking.startTime ||
                        '',
                    )}
                  </span>

                  <div className="za-compact-meta">
                    <span>
                      {booking.guests} Guests
                    </span>

                    {booking.roomName && (
                      <span>
                        · {booking.roomName}
                      </span>
                    )}
                  </div>
                </div>

                <div className="za-compact-side">
                  <span
                    className={`za-pill ${bookingStatusClass(
                      booking.status,
                    )}`}
                  >
                    {bookingStatusLabel(
                      booking.status,
                    )}
                  </span>

                  <button
                    type="button"
                    className="za-compact-icon-button"
                    title="View booking"
                    aria-label={`View booking for ${
                      booking.customerName || 'Customer'
                    }`}
                    onClick={() => onNavigate('bookings')}
                  >
                    <Eye size={15} />
                  </button>
                </div>
              </div>
            ))}

            {filteredBookings.length === 0 &&
              !bookingError &&
              bookingsLoaded && (
                <div className="za-compact-empty">
                  No booking requests found.
                </div>
              )}

            {filteredBookings.length === 0 &&
              !bookingError &&
              !bookingsLoaded && (
                <div className="za-compact-empty">
                  Loading room bookings...
                </div>
              )}
          </div>

          <button
            type="button"
            className="za-compact-footer"
            onClick={() => onNavigate('bookings')}
          >
            <span>View All Bookings</span>

            <span className="za-compact-count">
              {matchingBookings.length}
            </span>

            <ChevronRight />
          </button>
        </article>
      </section>
    </div>
  )
}
