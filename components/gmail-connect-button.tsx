"use client"

import { Button } from "@/components/ui/button"
import { Mail, Check } from "lucide-react"

interface GmailConnectButtonProps {
  hasGmailConnected: boolean
}

export default function GmailConnectButton({ hasGmailConnected }: GmailConnectButtonProps) {
  if (hasGmailConnected) {
    return (
      <Button variant="outline" className="text-green-600" disabled>
        <Check className="w-4 h-4 mr-2" />
        Gmail Connected
      </Button>
    )
  }

  return (
    <Button 
      variant="outline"
      onClick={() => window.location.href = "/api/integrations/gmail"}
      className="text-gray-600 hover:text-gray-900"
    >
      <Mail className="w-4 h-4 mr-2" />
      Connect Gmail
    </Button>
  )
} 