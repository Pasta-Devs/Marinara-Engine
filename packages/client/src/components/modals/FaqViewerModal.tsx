import { useState } from "react";
import { Modal } from "../ui/Modal";
import { HomeFaq } from "../chat/HomeFaq";
import { useTranslation } from "react-i18next";

export function FaqViewerModal({
  open,
  onClose,
  initialItemId,
}: {
  open: boolean;
  onClose: () => void;
  initialItemId?: string | null;
}) {
  const { t } = useTranslation();
  const [openItemId, setOpenItemId] = useState<string | null>(initialItemId ?? null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setOpenItemId(initialItemId ?? null);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("omnibar.faqTitle", "Professor Mari's FAQ")} width="max-w-5xl">
      <HomeFaq
        headerless
        faqOnly
        expanded
        openItemId={openItemId}
        onOpenItemIdChange={setOpenItemId}
        onAskMari={onClose}
        className="max-w-none"
      />
    </Modal>
  );
}
