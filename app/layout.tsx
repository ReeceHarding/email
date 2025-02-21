import "./globals.css"
import { ClerkProvider } from "@clerk/nextjs"
import Header from "@/components/header"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Email Outreach Automation",
  description: "AI-powered lead scraping and email automation"
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen bg-white text-gray-900 antialiased">
          <Header />
          <main className="p-6">
            {children}
          </main>
        </body>
      </html>
    </ClerkProvider>
  )
} 