import { notFound } from 'next/navigation';
import DesignPreview from '@/components/debug/DesignPreview';

export default function TestPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DesignPreview />;
}
