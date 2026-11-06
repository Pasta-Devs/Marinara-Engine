// Slice 8: her text for one editor field while she writes it. Provisional and read-only: the form
// keeps the user's text, and her in-field review or applied state takes over when the round ends.
import { useTranslation } from "react-i18next";
import { useMariAppearancePack } from "../../hooks/use-mari-appearance-pack";

export function MariFieldWriting({ text }: { text: string }) {
  const { t } = useTranslation();
  const pack = useMariAppearancePack();
  return (
    <div className="mari-field-review mari-field-review--writing">
      <div className="mari-field-review__strip" role="status">
        <img src={pack.portraits.idle} alt="" draggable={false} />
        <span>{t("mari.fieldReview.writing")}</span>
      </div>
      <p className="mari-field-review__text">{text}</p>
    </div>
  );
}
