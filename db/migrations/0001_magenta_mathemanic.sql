CREATE UNIQUE INDEX "user_website_idx" ON "leads" USING btree ("user_id","website_url");