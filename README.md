# TicketBari - Backend Server

**Live API Base URL**: `https://ticketbari-server.vercel.app`  
**Frontend Live**: [https://ticketbari-2025.web.app](https://ticketbari-2025.web.app)

This is the **Node.js + Express + MongoDB** backend server for the **TicketBari** online ticket booking platform.

---

## Features Implemented

- Complete **MERN Stack** backend
- Role-based access control (User, Vendor, Admin)
- Secure **JWT + Firebase Token** verification
- Admin approval workflow for vendor tickets
- Advertise up to **6 tickets** on homepage
- Booking system with status: pending → accepted → paid
- Stripe payment integration ready
- Image upload via **imgbb**
- Full CRUD for tickets, bookings, users
- Proper error handling & CORS
- Environment variables for security

---

## API Endpoints

### Auth & Users
| Method | Endpoint                     | Description                     | Access       |
|--------|------------------------------|----------------------------------|--------------|
| GET    | `/users/:email`              | Get user data                    | Protected    |
| GET    | `/users/:email/role`         | Get user role                    | Protected    |
| PATCH  | `/users/:email/role`         | Make Admin/Vendor                | Admin only   |
| PATCH  | `/users/:email/mark-fraud`   | Mark vendor as fraud             | Admin only   |

### Tickets
| Method | Endpoint                          | Description                         | Access           |
|--------|-----------------------------------|-------------------------------------|------------------|
| GET    | `/tickets`                        | All approved tickets                | Public           |
| GET    | `/tickets?status=pending`         | Pending tickets                     | Admin only       |
| GET    | `/tickets?vendorEmail=...`        | Vendor's own tickets                | Vendor only      |
| POST   | `/tickets`                        | Add new ticket (pending)            | Vendor only      |
| PATCH  | `/tickets/:id`                    | Update ticket                       | Vendor/Admin     |
| PATCH  | `/tickets/:id/status`             | Approve/Reject ticket               | Admin only       |
| PATCH  | `/tickets/:id/advertise`          | Toggle advertise (max 6)            | Admin only       |
| DELETE | `/tickets/:id`                    | Delete ticket                       | Vendor/Admin     |

### Bookings
| Method | Endpoint           | Description                     | Access        |
|--------|--------------------|---------------------------------|---------------|
| POST   | `/bookings`        | Create booking (pending)        | User only     |
| GET    | `/bookings`        | User’s bookings                 | User only     |
| PATCH  | `/bookings/:id`    | Accept/Reject booking           | Vendor only   |

### Payments
| Method | Endpoint           | Description                     | Access        |
|--------|--------------------|---------------------------------|---------------|
| POST   | `/create-payment-intent` | Stripe payment intent     | User only     |

---
