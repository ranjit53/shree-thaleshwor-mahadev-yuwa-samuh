import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import dynamic from 'next/dynamic';

const ChatBox = dynamic(() => import('@/components/ChatBox'), { ssr: false });

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-4">
          <h1 className="text-2xl font-semibold mb-4">Chat</h1>
          <ChatBox />
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
