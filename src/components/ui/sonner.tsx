import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/hooks/useTheme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      gap={8}
      toastOptions={{
        duration: 3500,
        style: {
          background: theme === 'dark' ? '#111113' : '#18181b',
          color: '#f4f4f5',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          minWidth: '280px',
          maxWidth: '380px',
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
