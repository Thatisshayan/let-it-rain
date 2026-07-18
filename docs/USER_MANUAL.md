# Let It Rain user manual

Let It Rain helps a team track stock, record stock movements, manage delivery
orders, and review operational reports. The same core features are available
on the web app and the iPhone app; small layout differences are normal.

## Sign in

For a freshly seeded Let It Rain installation, use:

| Field | Value |
| --- | --- |
| Name | Admin |
| Email / username | `admin@letitrain.app` |
| Password | `letitrain123` |

These are initial seed credentials, not a personal account recovery method.
They will not work if the password has already been changed or the deployment
uses a different database. Change this default password immediately after the
first sign-in: **Settings -> Account -> Change password**.

If you do not have an account, ask a user with **Manage users** permission to
create one for you. Public sign-up may be available on deployments where it has
been enabled; billing and Stripe setup remain separate from signing in.

## Home / Dashboard

The dashboard is the quickest daily overview. It shows low-stock items, recent
activity, and—when your permissions allow it—today's revenue. Use it to decide
what needs attention, then tap/click a card to open the relevant screen.

## Items and inventory

Open **Items** to browse the catalogue. You can search by name and use the
low-stock filter to focus on items whose quantity is below their minimum.

Select an item to see its current quantity and full movement history. Depending
on your access, you can:

- Create or edit an item.
- Receive stock when stock arrives.
- Remove stock for a non-order sale or other loss.
- Adjust a count after a stocktake.
- Export the item list or an item's movement history as CSV.

Every receive, removal, and adjustment creates an immutable movement record.
Enter a useful reason whenever possible: it makes later reconciliation much
easier. On a removal, record the Cash and/or Interac amount if it is a sale;
those amounts feed the reports.

## Orders and deliveries

Open **Orders** to create and track deliveries.

1. Create an order and add the requested items and quantities.
2. Assign a driver when one is available.
3. The assigned driver marks the order **Out for delivery**, then **Delivered**.
4. At delivery, enter any Cash/Interac payment for each line item.

Delivering an order reduces stock and records its sales value in one operation.
If stock is insufficient, the delivery is not partially applied. A driver can
update only orders assigned to them; other actions depend on the permissions
granted to their account.

The iPhone app can queue the *out for delivery* and *delivered* actions while
offline and sends them when connectivity returns. Keep the app installed and
open it again once connected so the queue can sync.

## Activity

**Activity** is the stock-movement calendar. Choose a day to see each receive,
removal, or adjustment, including who made it and the reason. Day colours show
the net stock change: green is positive, red is negative, and blue means there
was activity with no net change.

What you can see is permission-based. Delivery drivers and other limited users
may only see movements they authored.

## Reports

**Reports** provides operational accounting for the selected month:

- Revenue and payment breakdown (Cash and Interac)
- Cost of goods sold and gross profit
- Restock spending
- Current inventory valuation
- Revenue by day and sales by item

Reports use recorded sale payments and the cost/price captured when stock was
removed, so changing an item's price later does not rewrite past results.

## Settings and account security

Open **Settings** to manage your account:

- Update your name.
- Change your password.
- Sign out on every device if a phone is lost or you suspect an account issue.
- On iPhone, optionally enable Face ID app lock.

Users with the right permissions also see organization and user-management
settings. Administrators can create users, set their permissions, deactivate
accounts, reset passwords, and sign a user out everywhere. Give the smallest
set of permissions a person needs, especially for costs, reports, and user
management.

## Access and common limitations

Not every account sees every button. That is expected: Let It Rain hides or
denies actions that the account is not authorized to use. Ask an administrator
to review your permissions if you need access.

If the app says **Permission denied**, it means your account does not have the
required access; signing out and back in will not grant it. If it says it is
offline or a request failed, check your connection and retry. For an order
delivery queued offline, reconnect and reopen the iPhone app.

## Getting help

When reporting a problem, include the screen, the action you took, the exact
message, the approximate time, and whether you were using web or iPhone. Do
not send passwords in chat or screenshots.
