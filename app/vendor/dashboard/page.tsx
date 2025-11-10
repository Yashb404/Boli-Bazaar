import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Users, ShoppingCart } from "lucide-react";
import Link from "next/link";

// This is an async Server Component.
export default async function VendorDashboardPage() {

  const dashboardStats = [
    { title: "Active Pools in Your Area", value: 0, icon: Users, description: "Pools available to join now" },
    { title: "Successful Pools This Month", value: 0, icon: ShoppingCart, description: "Completed group purchases" },
  ];

  const quickActions = [
      { title: "Browse Pools", href: "/vendor/pools", icon: Package },
      { title: "Check My Orders", href: "/vendor/orders", icon: ShoppingCart },
  ];

  return (
    <>
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-lg text-gray-500 dark:text-gray-400">Welcome back, here&apos;s a summary of your activity.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardStats.map((stat, index) => (
          <Card key={index} className="rounded-xl shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold text-gray-700">{stat.title}</CardTitle>
              <stat.icon className="h-6 w-6 text-teal-600" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-teal-600">{stat.value}</div>
              <p className="text-sm text-gray-500 mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 rounded-xl shadow-md">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-gray-800">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {quickActions.map(action => (
              <Button asChild size="lg" key={action.title} className="bg-teal-600 hover:bg-teal-700">
                <Link href={action.href}>
                  <action.icon className="mr-2 h-5 w-5" /> {action.title}
                </Link>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
} 