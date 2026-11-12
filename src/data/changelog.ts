// Description: 功能更新記錄 — the changes a passenger can see or feel, shown from the side
// menu (ChangelogModal). Hand-written from the git history in plain words; leave out what
// a passenger cannot notice (scrapers, publication, caching, refactors, tests).
//
// Dates are the day the change went live, Taipei time, newest first. Every entry carries
// all four shipped locales side by side so none can be forgotten; changelog.test.ts pins
// the shape. Only ChangelogModal imports this file, and that modal is lazy-loaded, so the
// entries stay out of the entry bundle. When you ship a passenger-visible change, add it
// here in the same commit.

export type ChangeKind = "added" | "changed" | "removed";
export type ChangelogLocale = "zh-TW" | "en" | "ja" | "ko";

export const CHANGELOG_LOCALES: readonly ChangelogLocale[] = ["zh-TW", "en", "ja", "ko"];

export interface ChangeItem {
  kind: ChangeKind;
  text: Record<ChangelogLocale, string>;
}

export interface ChangeDay {
  /** YYYY-MM-DD, Taipei. */
  date: string;
  items: readonly ChangeItem[];
}

export const CHANGELOG: readonly ChangeDay[] = [
  {
    date: "2026-11-12",
    items: [
      {
        kind: "added",
        text: {
          "zh-TW": "選單新增「功能更新記錄」，列出近期新增、修改與移除的功能。",
          en: "A “What's new” list in the menu, showing recently added, changed and removed features.",
          ja: "メニューに「更新履歴」を追加し、最近追加・変更・削除された機能を一覧できるようにしました。",
          ko: "메뉴에 '업데이트 내역'을 추가해 최근 추가·변경·삭제된 기능을 볼 수 있습니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "選單與設定合併成從左側滑出的浮動卡片；語言、偏好地區、時區、幣別與主題都在這裡調整。",
          en: "The menu and settings are now one floating card that slides in from the left, with language, region, time zone, currency and theme in one place.",
          ja: "メニューと設定を、左から開く1枚のフローティングカードにまとめました。言語・地域・タイムゾーン・通貨・テーマはここで変更できます。",
          ko: "메뉴와 설정을 왼쪽에서 열리는 하나의 플로팅 카드로 합쳤습니다. 언어, 지역, 시간대, 통화, 테마를 한곳에서 바꿀 수 있습니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "手機版頁首變矮並顯示目前頁面名稱；時區與幣別在手機上也看得到，點一下開啟設定。",
          en: "On phones the header is shorter and names the page you are on; your time zone and currency now show there too and open the settings when tapped.",
          ja: "スマートフォンではヘッダーを低くし、表示中のページ名を出すようにしました。タイムゾーンと通貨も表示され、タップすると設定が開きます。",
          ko: "휴대폰에서는 헤더를 낮추고 현재 페이지 이름을 표시합니다. 시간대와 통화도 함께 보이며, 누르면 설정이 열립니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "往下捲動時，底部導覽列會自動隱藏，往上捲就回來。",
          en: "The bottom navigation bar hides while you scroll down and comes back as soon as you scroll up.",
          ja: "下にスクロールすると下部ナビゲーションが隠れ、上にスクロールするとすぐ戻ります。",
          ko: "아래로 스크롤하면 하단 내비게이션이 숨겨지고, 위로 스크롤하면 바로 다시 나타납니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "每個國家的頁首、底部導覽、按鈕與選中的排序都改用同一個代表色，不再出現兩種不同的顏色。",
          en: "Each country now uses one accent colour for the header, bottom bar, buttons and the selected sort, instead of two different ones.",
          ja: "国ごとに、ヘッダー・下部ナビ・ボタン・選択中の並べ替えを同じアクセントカラーにそろえました。",
          ko: "국가별로 헤더, 하단 내비게이션, 버튼, 선택한 정렬이 같은 대표 색을 쓰도록 통일했습니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "班次卡片更精簡：票價移到行車時間旁，時間改用一般數字字型；沒有官方路線色的列車改用灰色細線，不再顯示綠色。",
          en: "Departure cards are more compact: the fare sits beside the journey time, times use the regular typeface, and trains without an official line colour show a thin grey line instead of green.",
          ja: "便のカードをコンパクトにしました。運賃は所要時間の横に移り、時刻は通常の書体になりました。公式の路線色がない列車は緑ではなく細い灰色の線で表示します。",
          ko: "열차 카드를 더 간결하게 바꿨습니다. 요금은 소요 시간 옆으로 옮기고 시각은 일반 글꼴로 표시하며, 공식 노선 색이 없는 열차는 초록색 대신 얇은 회색 선으로 보여 줍니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "「最便宜」只標在還沒發車的班次；剩下的班次票價都相同時就不標。",
          en: "“Cheapest” now marks only trains still to depart, and is left off when the remaining fares are all the same.",
          ja: "「最安」はこれから出発する便にだけ付け、残りの運賃がすべて同じときは付けません。",
          ko: "'최저가'는 아직 출발하지 않은 열차에만 표시하고, 남은 열차의 요금이 모두 같으면 표시하지 않습니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "搜尋頁：國家改成可橫向捲動的膠囊並自動捲到目前國家；可選日期與當地時間分成兩個標籤，時區顯示城市名稱；未選車站時顯示「選擇車站」。",
          en: "Search page: countries are pills that scroll to the one you picked; the bookable dates and local time are two separate chips, with the time zone named by city; an empty station reads “Choose a station”.",
          ja: "検索ページ：国は横にスクロールする丸いボタンになり、選択中の国まで自動でスクロールします。選べる日付と現地時刻を2つのラベルに分け、タイムゾーンは都市名で表示します。駅が未選択のときは「駅を選択」と表示します。",
          ko: "검색 페이지: 국가는 가로로 넘기는 둥근 버튼이 되었고 선택한 국가로 자동 이동합니다. 선택 가능한 날짜와 현지 시간을 두 개의 라벨로 나누고 시간대는 도시 이름으로 보여 주며, 역을 고르지 않았을 때는 '역 선택'이라고 표시합니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "韓國的首爾、釜山等站在結果標題中改用你選的語言顯示，不再出現英文。",
          en: "Korean stations such as Seoul and Busan are now named in your language in the results title.",
          ja: "ソウル・プサンなど韓国の駅名を、結果のタイトルでも選択中の言語で表示します。",
          ko: "서울, 부산 등 한국 역 이름을 결과 제목에서도 선택한 언어로 표시합니다.",
        },
      },
      {
        kind: "changed",
        text: {
          "zh-TW": "「AI 行程規劃」與「台/鐵/捷運 查詢」從搜尋頁移到選單的「其它服務工具」。",
          en: "“Plan itinerary with AI” and “Taiwan Rail & Metro” moved from the search page to Other services in the menu.",
          ja: "「AIで旅程を計画」と「台湾鉄道・地下鉄」を検索ページからメニューの「その他のサービス」に移しました。",
          ko: "'AI로 일정 계획하기'와 '대만 철도·지하철'을 검색 페이지에서 메뉴의 '기타 서비스'로 옮겼습니다.",
        },
      },
      {
        kind: "removed",
        text: {
          "zh-TW": "頁首的個人設定按鈕與底部導覽的「設定」，改從選單進入。",
          en: "The profile button in the header and Settings in the bottom bar; settings now open from the menu.",
          ja: "ヘッダーのプロフィールボタンと下部ナビの「設定」を削除しました。設定はメニューから開けます。",
          ko: "헤더의 프로필 버튼과 하단 내비게이션의 '설정'을 없앴습니다. 설정은 메뉴에서 열 수 있습니다.",
        },
      },
    ],
  },
];

/** The locale a changelog entry is read in: the UI language, or English for any other. */
export function changelogLocale(language: string): ChangelogLocale {
  return (CHANGELOG_LOCALES as readonly string[]).includes(language) ? (language as ChangelogLocale) : "en";
}
