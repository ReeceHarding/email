import "./globals.css"
import { ReactNode } from "react"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Email Outreach Automation",
  description: "AI-powered lead scraping and email automation"
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="text-xl font-semibold">MySaaS</div>
          <nav className="space-x-4">
            <a href="/dashboard" className="font-medium hover:underline">
              Dashboard
            </a>
            <a href="/dashboard/billing" className="font-medium hover:underline">
              Billing
            </a>
          </nav>
        </header>

        <main className="p-6">
          {children}
        </main>
      </body>
    </html>
  )
} 