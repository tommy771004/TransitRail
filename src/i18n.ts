import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      header: {
        title: "TransitRoute"
      },
      nav: {
        search: "Search",
        history: "History",
        saved: "Saved",
        alerts: "Alerts"
      },
      search: {
        japan: "Japan",
        korea: "Korea",
        origin: "Origin",
        destination: "Destination",
        date: "Date",
        realtime_search: "Real-time Search",
        preview_ui: "Preview UI Design",
        plan_ai: "Plan with AI (High Thinking)",
        thinking: "Thinking...",
        ai_plan_title: "AI Transit Plan"
      },
      result: {
        today: "Today",
        adult: "Adult",
        modify: "Modify",
        fastest: "Fastest",
        earliest: "Earliest",
        cheapest: "Cheapest",
        cheapest_first: "Cheapest First",
        direct: "Direct",
        reserved_seat: "Reserved Seat",
        jr_pass_eligible: "JR Pass Eligible",
        travel_smarter: "Travel Smarter",
        get_realtime: "Get real-time delays and platform info with Premium.",
        origin_label: "ORIGIN",
        destination_label: "DESTINATION",
        all_times: "All Times",
        first_class: "First Class",
        economy_class: "Economy Class",
        non_stop: "Non-stop",
        select_seat: "Select Seat",
        limited_seats: "Limited seats available",
        travel_offer: "Travel Offer",
        book_stay: "Book your stay in Busan. Save up to 15% with KTX.",
        explore_partners: "Explore Hotel Partners",
        unable_to_fetch: "Unable to fetch real-time data"
      }
    }
  },
  'zh-TW': {
    translation: {
      header: {
        title: "TransitRoute"
      },
      nav: {
        search: "搜尋",
        history: "紀錄",
        saved: "儲存",
        alerts: "通知"
      },
      search: {
        japan: "日本",
        korea: "韓國",
        origin: "出發地",
        destination: "目的地",
        date: "日期",
        realtime_search: "即時搜尋",
        preview_ui: "預覽介面設計",
        plan_ai: "AI 智慧規劃 (高階推理)",
        thinking: "思考中...",
        ai_plan_title: "AI 交通規劃"
      },
      result: {
        today: "今天",
        adult: "成人",
        modify: "修改",
        fastest: "最快",
        earliest: "最早",
        cheapest: "最便宜",
        cheapest_first: "最便宜優先",
        direct: "直達",
        reserved_seat: "對號座",
        jr_pass_eligible: "適用 JR Pass",
        travel_smarter: "更聰明的旅行",
        get_realtime: "升級 Premium 獲取即時誤點及月台資訊。",
        origin_label: "出發地",
        destination_label: "目的地",
        all_times: "所有時間",
        first_class: "頭等艙",
        economy_class: "經濟艙",
        non_stop: "直達",
        select_seat: "選擇座位",
        limited_seats: "座位有限",
        travel_offer: "旅遊優惠",
        book_stay: "預訂釜山住宿，搭乘 KTX 享高達 85 折優惠。",
        explore_partners: "探索合作飯店",
        unable_to_fetch: "無法取得即時資料"
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'zh-TW', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
