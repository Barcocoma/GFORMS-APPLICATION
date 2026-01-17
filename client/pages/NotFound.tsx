import { useLocation, Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <Layout>
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-6xl font-bold text-gray-900">404</h1>
            <p className="text-xl text-gray-600 mt-2">Page not found</p>
          </div>
          <p className="text-gray-500 max-w-sm mx-auto">
            The page you're looking for doesn't exist. It might have been moved
            or deleted.
          </p>
          <Link to="/">
            <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFound;
