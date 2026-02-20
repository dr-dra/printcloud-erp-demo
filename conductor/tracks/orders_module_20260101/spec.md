# Specification: Orders Module

## Overview
The Orders module is a critical component of the PrintCloud ERP, bridging the gap between Sales (Quotations) and Production (Job Tickets). It allows staff to convert approved quotations into firm orders, manage order details, and initiate the production workflow.

## Functional Requirements
- **Order Creation:** Convert an existing Quotation into an Order.
- **Order Management:** List, view, edit, and cancel orders.
- **Order Status Tracking:** Track orders through states: Draft, Confirmed, In Production, Completed, Delivered, Invoiced.
- **Customer Linking:** Ensure every order is correctly linked to a customer.
- **Itemization:** Mirror items from the quotation into the order, allowing for adjustments if necessary.
- **File Management:** Link design files or customer documents to specific orders.

## Technical Details
- **Backend:** New Django app `apps/sales/orders/` (or within `apps/sales/`).
- **Models:** `Order`, `OrderItem`, `OrderFile`.
- **API:** RESTful endpoints for CRUD operations on orders.
- **Frontend:** New pages in `src/app/dashboard/sales/orders/`.
- **UI Components:** Reusable `DataTable` for order listing, multi-step forms for order creation/editing.

## User Stories
- As a Sales Rep, I want to convert an approved quote into an order so that production can begin.
- As a Production Manager, I want to see a list of confirmed orders so that I can schedule jobs.
- As an Accountant, I want to see completed orders so that I can generate invoices.
