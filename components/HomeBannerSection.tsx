import { createClient } from "@/lib/supabase/server";
import { getHomeBanner } from "@/lib/appSettings";
import BannerImage from "@/components/BannerImage";

export default async function HomeBannerSection() {
  const supabase = await createClient();
  const homeBanner = await getHomeBanner(supabase);

  return (
    <section className="rounded-2xl overflow-hidden bg-gray-100 h-40">
      <BannerImage src={homeBanner} alt="Banner" />
    </section>
  );
}
