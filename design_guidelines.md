# Travel Housing Finder - Design Guidelines

## Design Approach: Reference-Based (Travel Industry Leaders)

Drawing primary inspiration from **Airbnb** and **Booking.com** - establishing trust through visual appeal, showcasing properties effectively, and creating seamless search experiences. This approach prioritizes visual richness, user confidence, and intuitive discovery.

**Core Principles:**
- Image-first property presentation with generous whitespace
- Trust-building through professional photography and clean layouts
- Seamless filtering without overwhelming users
- Accessibility as foundational, not additive

## Color Palette

**Light Mode:**
- Primary: 220 75% 45% (Deep blue - trust and reliability)
- Background: 0 0% 98% (Soft white)
- Surface: 0 0% 100% (Pure white cards)
- Text Primary: 220 15% 20%
- Text Secondary: 220 10% 45%
- Success: 145 65% 42% (Availability indicators)
- Border: 220 12% 88%

**Dark Mode:**
- Primary: 220 75% 55%
- Background: 220 15% 10%
- Surface: 220 12% 14%
- Text Primary: 220 10% 95%
- Text Secondary: 220 8% 65%
- Success: 145 55% 48%
- Border: 220 10% 22%

**Accent (Sparingly):**
- Coral: 12 85% 58% (CTAs, featured badges)

## Typography

**Font Families:**
- Primary: 'Inter' (Google Fonts) - UI elements, body text
- Display: 'Poppins' (Google Fonts) - Headlines, property titles

**Scale:**
- Hero/Display: text-5xl font-bold (Poppins)
- Property Titles: text-2xl font-semibold (Poppins)
- Section Headers: text-3xl font-bold (Poppins)
- Body: text-base font-normal (Inter)
- Captions/Meta: text-sm font-medium (Inter)
- Filter Labels: text-sm font-medium (Inter)

## Layout System

**Tailwind Spacing Units:** 2, 4, 6, 8, 12, 16, 20, 24
- Micro spacing (badges, icons): 2, 4
- Component padding: 6, 8
- Section spacing: 12, 16, 20
- Major sections: 24

**Container Strategy:**
- Max-width: max-w-7xl for main content
- Search bar: max-w-4xl centered
- Property grids: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Filters sidebar: w-72 on desktop, full-width drawer on mobile

## Component Library

### A. Search & Filters
**Hero Search Bar:**
- Elevated card (shadow-lg) with rounded-2xl corners
- Three-section layout: Destination | Dates | Guests + Search button
- Each section separated by subtle dividers
- Coral accent for primary search button with rounded-full shape

**Filter Panel:**
- Sticky sidebar on desktop, bottom sheet on mobile
- Collapsible sections with smooth transitions
- Multi-select checkboxes with custom styling
- Price range slider with dual handles
- "Clear All" and "Apply Filters" actions at bottom

**Amenity Tags:**
- Pill-shaped badges with icons from Heroicons
- Checkbox-style selection (outline when unselected, filled when selected)
- Grid layout: grid-cols-2 md:grid-cols-3 gap-3

### B. Property Listings

**Property Cards:**
- 4:3 aspect ratio hero image with rounded-t-xl
- Hover: subtle scale and shadow enhancement
- Heart icon (top-right) for favorites with backdrop blur
- Image carousel indicators (bottom)
- Content padding: p-4
- Price displayed prominently (text-xl font-bold)
- Rating stars + review count
- Key amenities (max 3) as small icons with text
- Location with map pin icon

**List View Alternative:**
- Horizontal card: image left (w-64), content right
- More amenities visible (6-8)
- Larger description preview

### C. Detail View

**Property Header:**
- Full-width image gallery (primary + 4 thumbnails in grid)
- Breadcrumb navigation above
- Title, rating, location in overlay or below gallery
- Share and Save buttons (top-right with blur background)

**Information Sections:**
- Two-column layout: Details (left 2/3) | Booking card (right 1/3 sticky)
- Amenities grid with Heroicons
- Description with "Read more" expansion
- Map integration placeholder
- Reviews with star ratings and user avatars

**Booking Card:**
- Sticky position, shadow-xl
- Price per night prominent
- Date picker inline
- Guest counter
- Total price calculation
- "Reserve" CTA (coral accent)

### D. Accessibility Features

**High Contrast Toggle:**
- Icon button in header (adjustable-icon from Heroicons)
- Applies WCAG AAA contrast ratios when enabled

**Keyboard Navigation:**
- Visible focus rings (ring-2 ring-primary ring-offset-2)
- Skip to content link
- Logical tab order through filters and listings

**Screen Reader Optimization:**
- ARIA labels on all interactive elements
- Live regions for filter results count
- Descriptive alt text for all images
- Form field labels and error messages

**Text Sizing:**
- User preference toggle (small/medium/large)
- Affects body text while maintaining layout integrity

## Images

**Hero Section:**
- Large hero image (h-96 md:h-[500px]): Diverse travelers browsing accommodations on laptop/phone in modern, bright space
- Overlay with gradient (from-black/50 to-transparent) for text legibility
- Search bar positioned center, overlaying bottom third

**Property Images:**
- High-quality photographs showing room interiors, exteriors, key amenities
- Consistent 4:3 aspect ratio for cards
- Gallery view: Primary large (2/3 width) + 4 grid thumbnails (1/3)

**Supporting Images:**
- Trust badges/partner logos in footer
- Placeholder user avatars (circular) for reviews
- Icon-based amenity indicators (no photos)

**Image Treatment:**
- Lazy loading for performance
- Subtle rounded corners (rounded-xl)
- Maintain accessibility with proper alt descriptions

## Animations

**Minimal and Purposeful:**
- Card hover: transition-transform duration-200 hover:scale-[1.02]
- Filter apply: Subtle fade-in for results (opacity transition)
- Modal/drawer: Slide-in transitions (translate-y or translate-x)
- Loading states: Skeleton screens with pulse animation
- NO complex scroll-triggered animations