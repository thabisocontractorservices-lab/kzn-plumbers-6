# Connect KZN Plumbers leads to GoHighLevel (API version)

When this is set up, every quote request flows into GoHighLevel (GHL) automatically:
- **The homeowner becomes a GHL contact**, with the job details filled into "KZN" fields.
- **A card appears in a "KZN Leads" pipeline** and moves through these stages on its own: New → Accepted → Contacted → Quoted → Job won → Completed.
- **A tag starts your follow-up workflows.** The workflows message the homeowner, remind the plumber, and ask "Was the job done?"
- **The homeowner's answer comes back to the website.** "No" or "Not yet" emails you so you can step in.

The website uses the GHL API, which has no charge per lead. The workflows use the free "Contact Tag added" trigger, so you don't need the paid Inbound Webhook.

Allow about 45 minutes. Do the parts in order.

---

## Part A: Create the website's key in GHL (10 minutes)

1. Open your **KZN sub-account** in GHL, not the agency view. Go to **Settings → Private Integrations**.
   - If you don't see it, ask your agency admin to enable Private Integrations for the sub-account.
2. Click **Create new Integration**. Fill in:
   - Name: `KZN Plumbers website`
   - Description: `Sends quote requests from kznplumbers.co.za`
3. Tick these permissions (scopes):
   - `View Contacts` and `Edit Contacts` (contacts.readonly, contacts.write)
   - `View Custom Fields` and `Edit Custom Fields` (locations/customFields.readonly, locations/customFields.write)
   - `View Opportunities` and `Edit Opportunities` (opportunities.readonly, opportunities.write)
4. Click **Create**. GHL shows a token starting with `pit-`. **Copy it now.** GHL only shows it once.
   - Treat the token like a password. Paste it only into Vercel, never into chats or emails.
   - If it leaks, open Private Integrations and click **Rotate**.
5. Find your **Location ID**: go to **Settings → Business Profile**, find **Location ID** and click the copy icon.

## Part B: Create the pipeline (5 minutes, optional but recommended)

1. Go to **Opportunities → Pipelines → + Create new pipeline**.
2. Name it exactly **KZN Leads**.
3. Add these stages, in this order and spelled exactly like this:
   1. New
   2. Accepted
   3. Contacted
   4. Quoted
   5. Job won
   6. Completed
4. Click **Save**.

If you skip this part, contacts and follow-ups still work, but no pipeline cards are created.

## Part C: Add the settings in Vercel (5 minutes)

1. Open **Vercel → your kznplumbers project → Settings → Environment Variables**.
2. Add the variables below. For each one, tick **Production**, **Preview** and **Development**.

   | Name | Value |
   |---|---|
   | `GHL_API_TOKEN` | the `pit-…` token from Part A, step 4 |
   | `GHL_LOCATION_ID` | the Location ID from Part A, step 5 |
   | `GHL_INBOUND_SECRET` | a password you make up, at least 20 letters and numbers with no spaces or symbols. Save it in your password manager; you'll need it in Part F. |

   - **Don't add `GHL_LEAD_WEBHOOK_URL`.** That's the old paid method, kept only as a backup.
3. Push the new zip to GitHub as usual. If you added the variables after the deploy finished, go to **Vercel → Deployments → latest → ⋯ → Redeploy**.

## Part D: Test the connection (5 minutes)

1. Submit a test request at **kznplumbers.co.za/get-estimate** with your own mobile number.
2. In GHL, open **Contacts**. Within a minute you should see yourself with:
   - the tags `kzn-lead` and `kzn-new-request`
   - the KZN fields filled in. The website creates these fields automatically the first time: KZN Lead Ref, KZN Lead Status, KZN Service, KZN Suburb, KZN Urgency, KZN Estimate, KZN Plumber Name, KZN Plumber Phone, KZN Homeowner Link and others.
3. In **Opportunities → KZN Leads**, a card such as "KZN-1024 · Geyser repair · Umhlanga" should appear under **New**.
4. In **KZN Admin → Leads**, open the lead. The activity log should show **ghl sent**.
   - If it shows **ghl failed**, the log explains why. Common causes:
     - **401:** wrong token. Copy it again from Part A.
     - **403:** a permission is missing. Tick the scopes in Part A, step 3.
   - After fixing, click **Send to GoHighLevel again**.

## Part E: Build the follow-up workflows

Build each workflow the same way:
- Go to **Automation → Workflows → + Create Workflow → Start from scratch**.
- Set the trigger to **Contact Tag**, filter **Tag is added**, and choose the tag named for that workflow.

**Message channel:** use **WhatsApp** if it's connected in GHL. Otherwise use **SMS**. GHL handles STOP replies on its own.

**Inserting job details:** wherever a message needs them, click the **tag icon (Custom Values)** and choose **Contact → KZN …**. GHL inserts merge fields such as `{{contact.kzn_lead_ref}}`.

### Workflow "KZN – New request" (tag `kzn-new-request`)

You already send a confirmation email through Resend. Keep this WhatsApp/SMS message if you want a second channel, or delete it.

1. **Send WhatsApp/SMS** to the homeowner:
   > Hi {{contact.first_name}}, thanks for your KZN Plumbers request {{contact.kzn_lead_ref}} ({{contact.kzn_service}} in {{contact.kzn_suburb}}). Estimated range: {{contact.kzn_estimate}}. Your plumber has been sent the job. Track it: {{contact.kzn_homeowner_link}}
2. Add an **If/Else**: does **KZN Urgency** equal `Emergency`?
   - If yes, add a **Wait** of 30 minutes.
   - If no, add a **Wait** of 2 hours.
3. Add an **If/Else**: does **KZN Lead Status** equal `sent`? That means no plumber has accepted yet.
   - **Yes:** add **Send Internal Notification → SMS**, set to send to a specific phone number, and enter `{{contact.kzn_plumber_phone}}`:
     > KZN Plumbers: a homeowner in {{contact.kzn_suburb}} is waiting for you on job {{contact.kzn_lead_ref}} ({{contact.kzn_service}}). Open kznplumbers.co.za/dashboard/leads
   - Then add **Send Internal Notification → Email** to yourself:
     > No plumber has accepted {{contact.kzn_lead_ref}} yet.

### Workflow "KZN – Plumber accepted" (tag `kzn-plumber-accepted`)

1. **Send WhatsApp/SMS** to the homeowner:
   > Good news {{contact.first_name}}: {{contact.kzn_plumber_name}} accepted job {{contact.kzn_lead_ref}} and will contact you. Their number: {{contact.kzn_plumber_phone}}
2. Add a **Wait** of 1 day.
3. **Send WhatsApp/SMS** to the homeowner:
   > Hi {{contact.first_name}}, has {{contact.kzn_plumber_name}} contacted you about job {{contact.kzn_lead_ref}}? Reply 1 for YES or 2 for NO.
4. Add a **Wait** set to wait for the **contact to reply**, with a 2-day timeout.
5. Add an **If/Else** on the reply:
   - **Contains 1:** add a Webhook action (see Part F) with outcome `contacted`.
   - **Contains 2:** add a Webhook action with outcome `not_contacted`. You'll get an email.
6. Add a **Wait** of 4 days.
7. **Send WhatsApp/SMS** to the homeowner:
   > Was job {{contact.kzn_lead_ref}} done? Reply 1 DONE, 2 NOT YET, 3 CANCELLED.
8. Add a **Wait** for the reply, then an **If/Else**:
   - **Reply 1:** Webhook action with outcome `completed`, then send this message:
     > Thank you! Please rate {{contact.kzn_plumber_name}} here: {{contact.kzn_plumber_profile}}
   - **Reply 2:** Webhook action with outcome `not_done`. You'll get an email.
   - **Reply 3:** Webhook action with outcome `cancelled`.

### Workflow "KZN – Plumber declined" (tag `kzn-plumber-declined`)
1. Add **Send Internal Notification → Email/SMS** to yourself:
   > {{contact.kzn_plumber_name}} declined {{contact.kzn_lead_ref}}. Assign another plumber in Admin → Leads.

### Workflow "KZN – Job won" (tag `kzn-job-won`), optional
- Use this for anything you want to happen once a plumber marks the job as won, such as a thank-you message.

Click **Publish** on each workflow when it's ready.

## Part F: The Webhook action that sends answers back to the website

Wherever Part E says "Webhook action", add GHL's **Webhook** action with these settings:

- **Method:** POST
- **URL:** `https://www.kznplumbers.co.za/api/integrations/ghl?key=YOUR_GHL_INBOUND_SECRET`
  - Replace YOUR_GHL_INBOUND_SECRET with the password from Part C.
  - If the action has a **Headers** section, you can instead put the password in a header named `x-kzn-secret` and leave `?key=…` off the URL.
- **Custom Data:**

  | Key | Value |
  |---|---|
  | `lead_ref` | {{contact.kzn_lead_ref}} |
  | `outcome` | `contacted`, `not_contacted`, `completed`, `not_done` or `cancelled` |
  | `note` | the homeowner's reply text (optional) |

When you add this action, check whether GHL marks it as a paid "Premium" step. If it does, it costs $0.01 (about R0.18) per answer. That's about 2 answers per lead, or roughly R0.36 per lead. Contacts, fields, tags and pipeline updates from the website are free.

What each answer does:

| Outcome | On KZN Plumbers | In GHL |
|---|---|---|
| `contacted` | Lead moves to "Contacted" | Card moves to **Contacted** |
| `not_contacted` | Red tag on the lead, and **you get an email** | No change |
| `completed` | Lead moves to "Completed" | Card moves to **Completed** and is marked **Won** |
| `not_done` | Red tag on the lead, and **you get an email** | No change |
| `cancelled` | Lead moves to "Lost" | Card is marked **Lost** |

## Part G: Final end-to-end test

1. Submit a test request with your own number, choosing a plumber account you control.
2. Accept the job as that plumber in **/dashboard/leads**. The card should move to **Accepted**, and the "accepted" message should arrive on your phone.
3. To test quickly, change the waits in "KZN – Plumber accepted" to 1 minute.
4. Reply **1** to each question. The card should end in **Completed**, and the activity log in KZN Admin should show **ghl completed**.
5. Change the waits back to their normal times.

---

## How it works

**When the website updates GHL:**
- when a request is submitted
- when a plumber views, accepts, declines, contacts, quotes, wins or loses the job
- when you assign or remove a plumber, or change a status in admin
- when a homeowner's answer changes the status

**What each update does:**
1. Creates or updates the homeowner contact, matched by phone or email.
2. Refreshes all the KZN fields.
3. Adds `kzn-lead`, plus `kzn-emergency` for emergencies.
4. For these 4 events, removes and re-adds the workflow tag, so a returning customer's workflows run again:

   | Event | Tag |
   |---|---|
   | New request | `kzn-new-request` |
   | Plumber accepted | `kzn-plumber-accepted` |
   | Plumber declined | `kzn-plumber-declined` |
   | Job won | `kzn-job-won` |

5. Creates or moves the lead's card in **KZN Leads**. Its value is the estimate, or the job value once a plumber marks the job won.

**If something goes wrong:**
- **Leads never depend on GHL.** If GHL is down or the key is wrong, the lead still saves and Resend emails still go out. The activity log shows **ghl failed** and the reason, and **Send to GoHighLevel again** retries it.
- **To pause the connection**, remove `GHL_API_TOKEN` in Vercel and redeploy.

## Privacy (POPIA)
- The quote form's consent box says homeowners will receive updates and follow-ups about their job by WhatsApp, SMS or email.
- The Privacy Policy names GoHighLevel and says it may store data outside South Africa.
- Only follow up about the job unless the contact opted into marketing.
- If someone asks to be deleted, delete them in both KZN Admin and GHL.

## Backup method (not recommended)
The website can still post to a paid Inbound Webhook trigger instead of using the API:
- Set `GHL_LEAD_WEBHOOK_URL` in Vercel and leave `GHL_API_TOKEN` empty.
- This costs $0.01 per update, about 4–8 updates per lead.
- If both are set, the API is always used.
