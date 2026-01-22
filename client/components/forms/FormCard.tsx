import { MoreVertical, Edit2, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface FormCardProps {
  id: string;
  shareToken: string | null;
  title: string;
  description: string;
  responses: number;
  updatedAt: string;
  onDelete?: () => void;
}

export function FormCard({
  id,
  shareToken,
  title,
  description,
  responses,
  updatedAt,
  onDelete,
}: FormCardProps) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Owner's view - use form ID for editable view
  const linkPath = `/forms/${id}`;
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteDialog(true);
  };
  
  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/forms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete form');
      }

      toast({
        title: "Form Deleted",
        description: `"${title}" has been deleted successfully.`,
      });

      setShowDeleteDialog(false);
      
      // Trigger refresh of forms list
      if (onDelete) {
        onDelete();
      } else {
        window.dispatchEvent(new CustomEvent('formDeleted'));
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete form',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/create?edit=${id}`);
  };
  
  return (
    <>
      <Link to={linkPath} className="block h-full">
      <div className="bg-gray-100 rounded-xl border border-gray-300 hover:border-primary/30 hover:shadow-xl transition-all duration-300 overflow-hidden group h-full flex flex-col">
        {/* Form preview area */}
        <div className="h-36 bg-gradient-to-br from-gray-300 via-gray-200 to-gray-300 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          <div className="text-center relative z-10">
            <div className="text-5xl font-light text-gray-600">📋</div>
          </div>
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 bg-gray-200/90 hover:bg-gray-200 text-gray-700 shadow-sm"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem className="cursor-pointer gap-2" onClick={handleEditClick}>
                  <Edit2 className="h-4 w-4" />
                  <span>Edit</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer gap-2 text-destructive focus:text-destructive" onClick={handleDeleteClick}>
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Form info */}
        <div className="p-5 flex flex-col gap-3 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-base truncate group-hover:text-primary transition-colors mb-1">
                {title}
              </h3>
              <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                {description || "No description"}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-gray-500 border-t border-gray-100 pt-4 mt-auto">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-gray-700">{responses}</span>
              <span>response{responses !== 1 ? 's' : ''}</span>
            </div>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{updatedAt}</span>
          </div>
        </div>
      </div>
    </Link>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Form</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{title}"? This action cannot be undone and will delete all associated responses.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
