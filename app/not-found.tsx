"use server"

import { headers } from "next/headers"

export default async function NotFound() {
  // Properly await headers
  const headersList = await headers()
  
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-gray-600">Page not found</p>
    </div>
  )
} 