import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("HomePage");
  return (
    <div className="flex items-center">
      <h2>{t("title")}</h2>
      <Button variant="secondary">Click Me</Button>
    </div>
  )
}
