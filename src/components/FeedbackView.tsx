import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Send, AlertCircle, CheckCircle2, X, MapPin } from "lucide-react";
import { motion } from "motion/react";

interface FeedbackViewProps {
  onBack: () => void;
}

export function FeedbackView({ onBack }: FeedbackViewProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState("feature");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);
  
  const [locationData, setLocationData] = useState<{
    latitude?: number;
    longitude?: number;
    locationMethod?: string;
  }>({});
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "attached" | "unavailable">("idle");

  const attachLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationData({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          locationMethod: "html5",
        });
        setLocationStatus("attached");
        setIsLocating(false);
      },
      () => {
        setLocationStatus("unavailable");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  };

  const validate = (val: string) => {
    if (!val.trim()) {
      setErrorMsg(t("feedback.error_empty", "回饋內容不能為空"));
      return false;
    }
    setErrorMsg("");
    return true;
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (touched) {
      validate(val);
    }
  };

  const handleBlur = () => {
    setTouched(true);
    validate(content);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!validate(content)) return;

    setIsSubmitting(true);
    setStatus("idle");

    try {
      const res = await fetch("/api/feedbacks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          content,
          contact,
          ...locationData,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      
      setStatus("success");
      setContent("");
      setContact("");
      setTouched(false);
      setErrorMsg("");
    } catch (err) {
      console.error(err);
      setStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: "feature", label: t("feedback.category_feature", "功能建議") },
    { id: "bug", label: t("feedback.category_bug", "系統錯誤") },
    { id: "ui", label: t("feedback.category_ui", "介面優化") },
    { id: "other", label: t("feedback.category_other", "其它") },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onBack}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 30 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[32px] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
      <div className="overflow-hidden rounded-[32px] bg-[#FCF9F2] shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-900 dark:ring-slate-800">
        {status === "success" ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-12 w-12" />
            </motion.div>
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mb-2 text-xl font-black text-slate-800 dark:text-white"
            >
              {t("feedback.success_title", "提交成功！")}
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8 text-sm font-semibold text-slate-600 dark:text-slate-400 max-w-xs"
            >
              {t("feedback.success", "感謝您的意見回饋！")}
            </motion.p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onBack}
              className="w-full max-w-xs rounded-2xl bg-[#6A8B42] py-3.5 text-sm font-black text-white shadow-md shadow-[#6A8B42]/10 hover:bg-[#5A7342] dark:bg-[#72924C] dark:hover:bg-[#6A8B42]"
            >
              {t("feedback.close_btn", "關閉")}
            </motion.button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#F0EBE1] px-6 py-5 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-5 w-5 text-[#5A7342] dark:text-[#8CB066]" />
                <h2 id="feedback-title" className="text-lg font-black tracking-tight text-slate-800 dark:text-white">
                  {t("feedback.title", "意見回饋")}
                </h2>
              </div>
              <button
                onClick={onBack}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-200/50 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label={t("feedback.close_btn", "Close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="mb-6 text-[13px] font-semibold leading-relaxed text-slate-600 dark:text-slate-400">
                {t("feedback.description", "在您的協助下，我們能做得更好！如果您遇到任何系統錯誤或有新功能建議，歡迎隨時填寫表單通知我們。")}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Category Selection */}
                <div>
                  <label className="mb-2.5 block text-[13px] font-black text-slate-800 dark:text-slate-200">
                    {t("feedback.category", "回饋類別")}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {categories.map((cat) => {
                      const isSelected = category === cat.id;
                      return (
                        <motion.button
                          key={cat.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCategory(cat.id)}
                          className={`rounded-2xl py-3 px-3 text-sm font-bold transition-all ${
                            isSelected
                              ? "bg-[#6A8B42] text-white shadow-md shadow-[#6A8B42]/10 dark:bg-[#72924C]"
                              : "border border-[#E5E0D8] bg-transparent text-slate-700 hover:bg-[#F3EFE7] dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          }`}
                        >
                          {cat.label}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Content Textarea */}
                <div>
                  <div className="mb-2.5 flex items-center justify-between">
                    <label className="block text-[13px] font-black text-slate-800 dark:text-slate-200">
                      {t("feedback.content", "回饋內容")} <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {t("feedback.chars_remaining", { count: Math.max(0, 500 - content.length) })}
                    </span>
                  </div>
                  <textarea
                    required
                    maxLength={500}
                    value={content}
                    onChange={handleContentChange}
                    onBlur={handleBlur}
                    rows={4}
                    className={`w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:ring-4 dark:bg-slate-950 dark:text-white ${
                      errorMsg
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500/10 dark:border-red-500/80 dark:focus:border-red-500/80 dark:focus:ring-red-500/15"
                        : "border-[#E5E0D8] focus:border-[#6A8B42] focus:ring-[#6A8B42]/10 dark:border-slate-700 dark:focus:border-[#8CB066] dark:focus:ring-[#8CB066]/10"
                    }`}
                    placeholder={t("feedback.content_placeholder", "請描述您遇到的問題或您的建議與想法...")}
                  />
                  {errorMsg && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-500 dark:text-red-400 animate-pulse">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {errorMsg}
                    </p>
                  )}
                </div>

                {/* Contact Input */}
                <div>
                  <label className="mb-2.5 block text-[13px] font-black text-slate-800 dark:text-slate-200">
                    {t("feedback.contact", "聯絡方式 (選填)")}
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full rounded-2xl border border-[#E5E0D8] bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all focus:border-[#6A8B42] focus:ring-4 focus:ring-[#6A8B42]/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-[#8CB066] dark:focus:ring-[#8CB066]/10"
                    placeholder={t("feedback.contact_placeholder", "電子信箱、LINE ID 或其它聯絡管道")}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-700 dark:bg-slate-800/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-slate-800 dark:text-slate-200">{t("feedback.location_title", "Attach location (optional)")}</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{t("feedback.location_privacy", "Your precise location is requested only after you choose to attach it and is sent with this feedback.")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={attachLocation}
                      disabled={isLocating || locationStatus === "attached"}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {isLocating ? t("feedback.location_locating", "Locating...") : locationStatus === "attached" ? t("feedback.location_attached", "Location attached") : t("feedback.location_attach", "Attach")}
                    </button>
                  </div>
                  {locationStatus === "unavailable" ? <p className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">{t("feedback.location_unavailable", "Location was not attached. You can still send feedback.")}</p> : null}
                </div>

                {status === "error" && (
                  <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    {t("feedback.error", "意見回饋送出失敗，請稍後再試。")}
                  </div>
                )}

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={isSubmitting}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#6A8B42] px-4 py-3.5 text-sm font-black text-white shadow-sm transition-all hover:bg-[#5A7342] disabled:opacity-50 dark:bg-[#72924C] dark:hover:bg-[#6A8B42]"
                >
                  {isSubmitting ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      <Send className="h-[18px] w-[18px]" />
                      {t("feedback.submit", "送出意見回饋")}
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </>
        )}
      </div>
      </motion.div>
    </motion.div>
  );
}
