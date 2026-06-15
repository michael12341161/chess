import { Toaster } from 'react-hot-toast';

export default function NotificationSystem() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 2600,
        style: {
          borderRadius: '8px',
          background: '#151815',
          color: '#f7f3e8',
          border: '1px solid #2f3d33',
        },
      }}
    />
  );
}
