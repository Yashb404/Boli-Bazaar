import { SidebarProvider, SidebarTrigger} from "@/components/ui/sidebar"
import { AppSidebar } from "./_components/AppSidebar"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 flex justify-center overflow-x-hidden">
          <SidebarTrigger></SidebarTrigger>
          {children}
      </main>
    </SidebarProvider>
  )
}