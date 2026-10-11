import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import MapPage from "@/pages/map";
import DemandsList from "@/pages/demands-list";
import DemandCreate from "@/pages/demand-create";
import DemandDetail from "@/pages/demand-detail";
import Dashboard from "@/pages/dashboard";
import PublicWorks from "@/pages/public-works";
import Departments from "@/pages/departments";
import DepartmentDetail from "@/pages/department-detail";
import Profile from "@/pages/profile";
import Ranking from "@/pages/ranking";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminServiceOrders from "@/pages/admin-service-orders";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/mapa" component={MapPage} />
      <Route path="/demandas" component={DemandsList} />
      <Route path="/demandas/nova" component={DemandCreate} />
      <Route path="/demandas/:id" component={DemandDetail} />
      <Route path="/painel" component={Dashboard} />
      <Route path="/obras" component={PublicWorks} />
      <Route path="/secretarias" component={Departments} />
      <Route path="/secretarias/:id" component={DepartmentDetail} />
      <Route path="/perfil/:id" component={Profile} />
      <Route path="/ranking" component={Ranking} />
      
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/ordens" component={AdminServiceOrders} />

      <Route path="/login" component={Login} />
      <Route path="/cadastro" component={Register} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
