CREATE TABLE "emails" (
	"id" serial PRIMARY KEY NOT NULL,
	"lead_id" varchar(255) NOT NULL,
	"direction" varchar(50) NOT NULL,
	"content" text NOT NULL,
	"thread_id" varchar(255),
	"message_id" varchar(255),
	"is_draft" boolean DEFAULT false NOT NULL,
	"needs_approval" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"company_name" varchar(255),
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"website_url" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"scraped_data" jsonb,
	"requires_human" boolean DEFAULT false NOT NULL,
	"billed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL
);
