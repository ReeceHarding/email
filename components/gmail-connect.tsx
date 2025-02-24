"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { checkGmailConnectionAction, disconnectGmailAction } from "@/actions/gmail-actions";
import { Button } from "@/components/ui/button";
import { Mail, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function GmailConnect() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check for messages or errors from redirect
  useEffect(() => {
    const message = searchParams.get("message");
    const error = searchParams.get("error");
    
    if (message) {
      toast.success(message);
      // Clean up URL
      router.replace("/dashboard");
    }
    
    if (error) {
      toast.error(error);
      // Clean up URL
      router.replace("/dashboard");
    }
  }, [searchParams, router]);
  
  // Check Gmail connection status
  useEffect(() => {
    async function checkConnection() {
      try {
        const result = await checkGmailConnectionAction();
        if (result.isSuccess) {
          setIsConnected(result.data);
        } else {
          console.error("[GmailConnect] Connection check failed:", result.message);
          setIsConnected(false);
        }
      } catch (error) {
        console.error("[GmailConnect] Error checking connection:", error);
        setIsConnected(false);
      }
    }
    
    checkConnection();
  }, []);
  
  // Connect to Gmail
  const handleConnect = () => {
    setIsLoading(true);
    window.location.href = "/api/email-gmail";
  };
  
  // Disconnect from Gmail
  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      const result = await disconnectGmailAction();
      if (result.isSuccess && result.data) {
        toast.success("Gmail disconnected successfully");
        setIsConnected(false);
      } else {
        toast.error(result.message || "Failed to disconnect Gmail");
      }
    } catch (error) {
      console.error("[GmailConnect] Error disconnecting:", error);
      toast.error("An error occurred while disconnecting Gmail");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show loading state while checking connection
  if (isConnected === null) {
    return (
      <Button variant="outline" disabled className="w-full md:w-auto">
        <Mail className="mr-2 h-4 w-4" />
        Checking Gmail connection...
      </Button>
    );
  }
  
  // Show connected state
  if (isConnected) {
    return (
      <div className="flex gap-2">
        <Button variant="outline" className="text-green-600 w-full md:w-auto" disabled>
          <Check className="mr-2 h-4 w-4" />
          Gmail Connected
        </Button>
        <Button 
          variant="outline" 
          className="text-red-600 w-full md:w-auto"
          onClick={handleDisconnect}
          disabled={isLoading}
        >
          <X className="mr-2 h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }
  
  // Show disconnected state
  return (
    <Button 
      variant="outline" 
      className="text-gray-600 hover:text-gray-900 w-full md:w-auto"
      onClick={handleConnect}
      disabled={isLoading}
    >
      <Mail className="mr-2 h-4 w-4" />
      {isLoading ? "Connecting..." : "Connect Gmail"}
    </Button>
  );
} 