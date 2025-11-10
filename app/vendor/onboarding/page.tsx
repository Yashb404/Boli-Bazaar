import { OnboardingMapLoader } from './_components/OnboardingMapLoader';

export const dynamic = 'force-dynamic';


export default async function page() {

  return <OnboardingMapLoader cities={[]} />;
}