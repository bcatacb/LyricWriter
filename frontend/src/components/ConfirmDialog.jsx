import React from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "./ui/alert-dialog";

/**
 * Controlled confirmation dialog with shadcn AlertDialog styled for neon theme.
 * Usage:
 *   const [open, setOpen] = useState(false)
 *   <ConfirmDialog open={open} onOpenChange={setOpen}
 *     title="Archive this track?" description="..."
 *     confirmLabel="Archive" destructive onConfirm={() => doIt()} />
 */
export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
    onConfirm,
    testIdPrefix = "confirm",
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent
                className="bg-[#121212] border border-[#222] rounded-none text-[#EDEDED] max-w-md"
                data-testid={`${testIdPrefix}-dialog`}
            >
                <AlertDialogHeader>
                    <AlertDialogTitle className="font-display uppercase tracking-tight text-[#EDEDED]">
                        {title}
                    </AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription className="text-[#A0A0A0]">
                            {description}
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        className="bg-transparent border border-[#222] text-[#A0A0A0] hover:bg-[#1a1a1a] hover:text-[#EDEDED] rounded-none font-mono text-xs tracking-[0.2em] uppercase"
                        data-testid={`${testIdPrefix}-cancel`}
                    >
                        {cancelLabel}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={
                            destructive
                                ? "bg-red-500 text-white hover:bg-red-600 rounded-none font-mono text-xs tracking-[0.2em] uppercase"
                                : "bg-[#39FF14] text-black hover:bg-[#00FF41] rounded-none font-mono text-xs tracking-[0.2em] uppercase font-bold"
                        }
                        data-testid={`${testIdPrefix}-confirm`}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
