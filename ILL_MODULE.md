# Interlibrary Loan (ILL) Module Documentation

**Version:** 1.0
**Created:** 2025-12-30
**Migration:** 018_ill_module.sql

## Overview

The Interlibrary Loan (ILL) module enables libraries to borrow materials from partner libraries for their patrons and lend materials to other libraries. This comprehensive system manages the entire ILL workflow from request submission to completion.

## Features

### Borrowing Workflow (We Request from Others)
1. **Patron Request Submission** - Patrons submit requests via web form
2. **Staff Review** - Staff approve/deny requests based on availability
3. **Partner Selection** - Staff select appropriate lending library
4. **Request Transmission** - Email notification sent to partner
5. **Shipment Tracking** - Track incoming shipments
6. **Item Receipt** - Check in borrowed items
7. **Patron Notification** - Notify patron item is ready
8. **Checkout** - Patron borrows the item
9. **Return Workflow** - Patron returns, ship back to lender

### Lending Workflow (We Lend to Others)
1. **Request Receipt** - Receive requests from partner libraries
2. **Availability Check** - Verify item availability
3. **Approve/Deny** - Staff decision based on policies
4. **Pull from Shelf** - Locate and prepare item
5. **Ship to Borrower** - Package and ship with tracking
6. **Return Receipt** - Item returned by borrower
7. **Return to Shelf** - Re-shelve item

### Partner Library Management
- Add/edit partner libraries
- Contact information management
- Agreement types (reciprocal, fee-based, consortial)
- Borrowing/lending permissions
- Loan period and renewal settings
- Activity statistics (total borrowed/lent)

### Statistics & Reporting
- Monthly activity trends (last 12 months)
- Status breakdowns (borrowing and lending)
- Average turnaround times
- Top partner libraries
- Success rates
- Total transaction counts

## Database Schema

### Tables

#### `ill_partners`
Stores information about partner libraries.

**Key Fields:**
- `library_name` - Partner library name
- `library_code` - OCLC symbol or unique code
- `library_type` - academic, public, special, etc.
- `contact_email`, `ill_email` - Contact information
- `agreement_type` - reciprocal, fee-based, consortial
- `lending_allowed`, `borrowing_allowed` - Permissions
- `max_loans_per_patron` - Borrowing limit
- `loan_period_days` - Default loan period
- `total_borrowed`, `total_lent` - Activity counters

#### `ill_requests`
Tracks both borrowing and lending requests.

**Key Fields:**
- `request_type` - 'borrowing' or 'lending'
- `patron_id` - Requesting patron (for borrowing)
- `partner_library_id` - Partner library
- `title`, `author`, `isbn`, `issn` - Item identification
- `material_type` - book, article, dvd, etc.
- `status` - Workflow status (see below)
- `needed_by_date`, `due_date` - Important dates
- `fee_amount`, `fee_paid` - Fee tracking

**Status Workflow:**
1. `pending` - Initial state, needs review
2. `approved` - Approved by staff
3. `requested` - Request sent to partner
4. `shipped` - Item shipped
5. `received` - Item received
6. `available` - Ready for patron pickup
7. `checked_out` - Patron has item
8. `returned` - Patron returned item
9. `completed` - Returned to lending library
10. `cancelled` - Request cancelled
11. `denied` - Request denied

#### `ill_shipments`
Tracks shipping information for ILL items.

**Key Fields:**
- `ill_request_id` - Associated request
- `direction` - 'incoming' or 'outgoing'
- `carrier` - USPS, UPS, FedEx, etc.
- `tracking_number` - Shipment tracking
- `shipped_date`, `expected_arrival_date`, `actual_arrival_date`
- `weight_oz`, `packaging_type` - Package details
- `shipping_cost` - Cost tracking

### Row Level Security (RLS)

All tables use RLS policies:
- **Public read**: Active partners visible to all
- **Patron access**: Patrons can view their own requests
- **Staff access**: Authenticated users have full access
- **Patron creation**: Patrons can create borrowing requests

## API Endpoints

### `/api/ill/requests`
**GET** - Fetch ILL requests with filtering
Query parameters: `type`, `status`, `patron_id`, `partner_id`, `start_date`, `end_date`, `page`, `limit`

**POST** - Create new ILL request
Body: Request data including `request_type`, `title`, `patron_id`, etc.

**PUT** - Update ILL request
Body: `id` and fields to update

**DELETE** - Delete ILL request
Query parameter: `id`

### `/api/ill/partners`
**GET** - Fetch partner libraries
Query parameters: `active`, `type`, `search`

**POST** - Create partner library
Body: Partner data

**PUT** - Update partner library
Body: `id` and fields to update

**DELETE** - Delete partner library
Query parameter: `id`

### `/api/ill/shipments`
**GET** - Fetch shipments
Query parameters: `request_id`, `direction`, `tracking`

**POST** - Create shipment
Body: Shipment data

**PUT** - Update shipment
Body: `id` and fields to update

**DELETE** - Delete shipment
Query parameter: `id`

## User Interfaces

### Admin Interfaces

#### `/admin/ill`
**ILL Dashboard** - Overview of all ILL activity
- Statistics summary
- Pending request counts
- Recent requests
- Status breakdowns
- Quick links

#### `/admin/ill/partners`
**Partner Library Management**
- List all partner libraries
- Add/edit partners
- Search and filter
- Activate/deactivate partners
- View statistics

#### `/admin/ill/borrowing`
**Borrowing Request Queue**
- List borrowing requests
- Filter by status
- Approve/deny requests
- Create new requests (staff-initiated)
- Status updates
- Quick actions

#### `/admin/ill/lending`
**Lending Request Queue**
- List lending requests from other libraries
- Approve/deny based on availability
- Track shipments
- Status workflow management

#### `/admin/ill/statistics`
**Statistics & Reports**
- Monthly activity charts
- Status breakdowns
- Average turnaround times
- Top partner libraries
- Success rates

### Patron Interfaces

#### `/catalog/ill/request`
**ILL Request Form** - Patron-facing request submission
- Item information form
- Material type selection
- Needed by date
- Pickup location
- Additional notes
- What is ILL? information

#### `/catalog/ill/my-requests`
**My ILL Requests** - Patron request history
- Active requests with status
- Past requests
- Status messages
- Request details

## Installation

### 1. Apply Migration

Run the migration in Supabase SQL Editor:

```bash
migrations/018_ill_module.sql
```

This creates:
- 3 tables: `ill_partners`, `ill_requests`, `ill_shipments`
- Indexes for performance
- RLS policies
- Triggers for statistics and timestamps
- Sample partner libraries

### 2. Verify Tables

Check Supabase Table Editor:
- ✓ `ill_partners` exists
- ✓ `ill_requests` exists
- ✓ `ill_shipments` exists
- ✓ RLS policies enabled

### 3. Test Access

1. Navigate to `/admin/ill`
2. View dashboard
3. Check partner libraries at `/admin/ill/partners`
4. Try creating a borrowing request

## Usage Guide

### For Library Staff

#### Adding a Partner Library

1. Go to `/admin/ill/partners`
2. Click "Add Partner Library"
3. Fill in library information:
   - Library name (required)
   - Library code (e.g., OCLC symbol)
   - Contact information
   - ILL email and phone
   - Address
   - Agreement type
   - Loan settings
4. Click "Create Partner"

#### Processing a Borrowing Request

1. Go to `/admin/ill/borrowing`
2. Filter by status: "Pending"
3. Review request details
4. Click "Approve" or "Deny"
5. If approved:
   - Select partner library (if not already assigned)
   - Click "Mark Requested" to send request
   - Add shipment tracking when item ships
   - Click "Mark Received" when item arrives
   - Click "Mark Available" to notify patron

#### Processing a Lending Request

1. Go to `/admin/ill/lending`
2. Filter by status: "Pending"
3. Check if item is available
4. Click "Approve" or "Deny"
5. If approved:
   - Pull item from shelf
   - Create shipment record
   - Enter tracking information
   - Ship to requesting library
6. When returned: Click "Mark Completed"

#### Tracking Shipments

Shipments are automatically created when status changes to "shipped". You can:
- View shipments from request details
- Add tracking numbers via API or manual entry
- Update actual arrival dates
- Track shipping costs

### For Patrons

#### Submitting an ILL Request

1. Go to `/catalog/ill/request`
2. Fill in item information:
   - Title (required)
   - Author
   - ISBN or ISSN (if known)
   - Publisher and year
   - Material type
3. Add request details:
   - Needed by date (optional)
   - Pickup location
   - Additional notes
4. Click "Submit Request"
5. Wait for email notification when approved

#### Checking Request Status

1. Go to `/catalog/ill/my-requests`
2. View active requests
3. Check status and messages
4. See due dates
5. View past requests

## Configuration

### Email Notifications (Future Enhancement)

The system is designed for email notifications at key workflow points:
- Patron: Request approved
- Patron: Item available for pickup
- Patron: Item overdue
- Partner: New lending request
- Partner: Item returned

To implement, create email templates and integrate with your email service.

### Fee Management

The schema includes fee tracking fields:
- `fee_amount` - Amount charged
- `fee_paid` - Payment status
- `fee_notes` - Additional notes

Implement fee calculation based on:
- Partner agreement type
- Shipping costs
- Overdue charges

### Pickup Locations

Create a list of pickup locations for patron selection:
- Main Library
- Branch locations
- Department libraries

### Material Types

Current material types:
- book
- article
- dvd
- cd
- periodical
- other

Customize based on your collection.

## Workflow Automation

### Status Transitions

The system automatically updates dates when status changes:
- `approved` → Sets `approved_date`
- `requested` → Sets `requested_date`
- `shipped` → Sets `shipped_date`
- `received` → Sets `received_date`
- `returned` → Sets `returned_date`
- `completed` → Sets `completed_date`

### Statistics Updates

Partner statistics (`total_borrowed`, `total_lent`) automatically update when requests are completed via database trigger.

## Best Practices

### For Staff

1. **Review requests promptly** - Check pending queue daily
2. **Communicate with partners** - Maintain good relationships
3. **Track all shipments** - Use tracking numbers
4. **Update statuses** - Keep patrons informed
5. **Monitor turnaround times** - Aim for < 14 days
6. **Maintain partner records** - Keep contact info current

### For Patrons

1. **Provide complete information** - Include ISBN when possible
2. **Allow sufficient time** - Request at least 2 weeks in advance
3. **Pick up promptly** - When notified item is ready
4. **Return on time** - Respect due dates
5. **Check status online** - Use the "My ILL Requests" page

## Troubleshooting

### Request Not Appearing

**Problem:** Patron submitted request but staff don't see it
**Solution:** Check RLS policies, verify patron has `patron_id`

### Cannot Delete Partner

**Problem:** "Cannot delete partner with active requests"
**Solution:** Mark partner as inactive instead, or complete all active requests first

### Shipment Status Not Updating

**Problem:** Status doesn't change when shipment arrives
**Solution:** Manually update shipment `actual_arrival_date`, triggers will update request status

### Statistics Not Updating

**Problem:** Partner statistics not incrementing
**Solution:** Verify trigger `trigger_update_partner_statistics` is active

## Future Enhancements

### Planned Features
1. **Email Notifications** - Automated patron and partner notifications
2. **Z39.50 Integration** - Search external catalogs
3. **OCLC Integration** - Connect to WorldCat ILL
4. **Document Delivery** - Electronic article delivery
5. **Batch Operations** - Process multiple requests at once
6. **Advanced Analytics** - More detailed reports
7. **Mobile App** - Mobile request submission
8. **Patron Self-Service** - Renewal requests, holds
9. **Cost Tracking** - Detailed financial reports
10. **SLA Monitoring** - Track performance against targets

### Integration Points
- **MARC Records** - Link ILL items to catalog records
- **Patrons** - Integrated with patron management
- **Holdings** - Check local availability before requesting
- **Circulation** - Track checked out ILL items

## Support

For questions or issues with the ILL module:
1. Check this documentation
2. Review CLAUDE.md for general system info
3. Check migration file comments
4. Review API endpoint documentation
5. Contact development team

## Version History

### Version 1.0 (2025-12-30)
- Initial release
- Complete borrowing and lending workflows
- Partner library management
- Statistics and reporting
- Patron request submission
- Shipment tracking
- Database schema with RLS
- API endpoints
- Admin and patron interfaces

---

**Maintained by:** ILS Development Team
**Last Updated:** 2025-12-30
