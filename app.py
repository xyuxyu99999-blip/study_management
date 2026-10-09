import calendar
import os
from datetime import date

import pandas as pd
import streamlit as st

# スマホでタップした瞬間にサイドバーを強制的に閉じるためのJavaScriptを仕込む
# ラジオボタンがクリックされたら、Streamlit標準の「サイドバーを閉じるボタン」を自動でクリックさせます
st.components.v1.html("""
    <script>
    window.parent.document.addEventListener('click', function(e) {
        // サイドバー内のラジオボタン（メニュー）のテキストがクリックされたか判定
        const isSidebarMenu = e.target.closest('[data-testid="stSidebar"] [data-testid="stWidgetLabel"]') || 
                              e.target.closest('[data-testid="stSidebar"] label');
        
        if (isSidebarMenu) {
            // 画面幅がスマホサイズ（768px以下）の場合のみ実行
            if (window.parent.innerWidth <= 768) {
                setTimeout(() => {
                    // Streamlitのサイドバーを閉じる「X」ボタン（または左上のアイコン）を探してクリック
                    const closeButton = window.parent.document.querySelector('[data-testid="stSidebar"] button');
                    if (closeButton) {
                        closeButton.click();
                    }
                }, 100); // ページ遷移の処理と被らないようにわずかに遅延
            }
        }
    });
    </script>
""", height=0, width=0)

# セッション状態（どのページを開いているか）の初期化
if "current_page" not in st.session_state:
    st.session_state.current_page = "ホーム"

# サイドバーを操作したときに動く関数（コールバック）


def on_sidebar_change():
    st.session_state.current_page = st.session_state.sb_radio


# サイドバーメニューの配置
page_list = ["ホーム", "定期テスト", "ToDoリスト", "カレンダー"]
selected_page = st.sidebar.radio(
    "メニュー",
    page_list,
    index=page_list.index(st.session_state.current_page),
    key="sb_radio",             # サイドバーの状態を記憶するキー
    on_change=on_sidebar_change  # クリックされた瞬間に状態を同期
)

TODO_FILE = "todo_list.csv"


def load_todos():
    """CSVファイルからTodoデータを読み込む関数"""
    if not os.path.exists(TODO_FILE):
        return []

    df = pd.read_csv(TODO_FILE)
    df = df.drop(columns=["subject"], errors="ignore")
    if "due_date" not in df.columns:
        df["due_date"] = ""
    todo_list = df.to_dict(orient="records")
    for item in todo_list:
        due_date = item.get("due_date")
        item["due_date"] = "" if pd.isna(due_date) else str(due_date)
    return todo_list


def save_todos(todo_list):
    """TodoデータをCSVファイルに保存する関数"""
    df = pd.DataFrame(todo_list).reindex(columns=["task", "due_date", "done"])
    df.to_csv(TODO_FILE, index=False)


if st.session_state.current_page == "ホーム":
    st.title("勉強管理アプリ")
    st.write("勉強管理アプリへようこそ！")

    st.title("ホーム画面")
    st.write("ここではテスト結果の記録やToDoリストの作成をすることができます。")

    st.markdown("---")
    st.subheader("メニュー ショートカット")

    # スマホでも押しやすいように、横並びではなく縦並びの大きなボタンにします
    # ボタンが押されたらセッション状態を書き換えて画面を再起動(st.rerun)します
    if st.button("📝 定期テスト記録を付ける", use_container_width=True):
        st.session_state.current_page = "定期テスト"
        st.rerun()

    st.write("")  # 少し隙間を空ける

    if st.button("✅ ToDoリストを作成、確認する", use_container_width=True):
        st.session_state.current_page = "ToDoリスト"
        st.rerun()

elif st.session_state.current_page == "定期テスト":
    st.title("📝定期テスト")
    st.write("テスト結果の入力すると表やグラフになります")

    CSV_FILE = "test_results.csv"

    exam = st.text_input("テスト名", placeholder="例：1年前期中間テスト")
    subject = st.text_input("教科名", placeholder="例：数学I、論理表現I")
    score = st.number_input("テスト点数", min_value=0, max_value=100)

    if st.button("テスト結果を保存する"):
        if subject.strip() == "":
            st.error("教科名を入力してください。")
        else:  # 新しいデータを1行分の表（ データフレーム） にする
            new_data = pd.DataFrame([{
                "テスト": exam,
                "教科": subject,
                "点数": score
            }])

        # すでにファイルがある場合は「 追記」、 ない場合は「 新規作成」
        if os.path.exists(CSV_FILE):
            new_data.to_csv(CSV_FILE, mode="a", header=False,
                            index=False, encoding="utf-8-sig")
        else:
            new_data.to_csv(CSV_FILE, mode="w", header=True,
                            index=False, encoding="utf-8-sig")

        st.success(f"「{exam}: {subject}: {score}点」を保存しました！")

    # ── 3. 保存されたCSVファイルを読み込んで分析・ 表示する──
    st.subheader("📊 テスト結果の分析と一覧")

    if os.path.exists(CSV_FILE):  # CSVファイルを読み込む
        df = pd.read_csv(CSV_FILE, encoding="utf-8-sig")

        # 💡【 重要】 平均点と最高点を計算する# 点数カラム（ 列） から、 平均と最大を計算（ 平均は小数第1位で四捨五入）
        average_score = round(df["点数"].mean(), 1)
        max_score = df["点数"].max()
        total_tests = len(df)  # テストの合計回数

        # ── 3 - 1. 平均点などを大きな文字で横並びに表示（ st.columnsを使う）──
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric(label="現在の平均点", value=f"{average_score} 点")
        with col2:
            st.metric(label="これまでの最高点", value=f"{max_score} 点")
        with col3:
            st.metric(label="受験したテスト数", value=f"{total_tests} 回")

        st.write("---")  # 区切り線

        # --- 閲覧・絞り込みエリア ---
        st.subheader("テスト結果の一覧・絞り込み")

        if not df.empty:
            # 1. 重複のないテスト名の一覧を取得
            unique_tests = df["テスト"].unique().tolist()

        # 全体表示用の選択肢も追加
        options = ["すべて表示"] + unique_tests

        # 2. セレクトボックスで絞り込みたいテスト名を選択
        # 2. st.selectboxの代わりにst.pillsを使って、ボタン感覚で選択させる
        selected_test = st.pills(
            "絞り込みたいテスト名を選択してください",
            options,
            selection_mode="single",  # 1つだけ選択する設定
            default="すべて表示"      # 初期状態の選択
        )

        # 3. 選択されたテスト名でデータをフィルタリング
        if selected_test == "すべて表示":
            filtered_df = df
        else:
            filtered_df = df[df["テスト"] == selected_test]

        # 4. 画面に表示
        st.dataframe(filtered_df, hide_index=True)

        # おまけ：絞り込んだデータの平均点などを表示
        if selected_test != "すべて表示":
            avg_score = filtered_df["点数"].mean()
            st.metric(label=f"{selected_test} の平均点",
                      value=f"{avg_score:.1f} 点")

    else:
        st.info("まだ保存されたデータはありません。最初のデータを登録してください。")

    # ホームに戻るボタン
    if st.button("⬅️ ホームに戻る", use_container_width=True):
        st.session_state.current_page = "ホーム"
        st.rerun()

elif st.session_state.current_page == "ToDoリスト":
    st.title("ToDoリスト")
    st.write("課題やテスト日程などを決めましょう")

    def show_todo():
        st.title("📋 Todoリスト")

        # 1. データの初期化（CSVから読み込み）
        if "todo_list" not in st.session_state:
            st.session_state.todo_list = load_todos()

        # 2. 入力フォームの作成
        st.subheader("新しいタスクを追加")
        with st.form("todo_form", clear_on_submit=True):
            task = st.text_input("タスク", placeholder="例: ワークのP.20〜25を解く")
            due_date = st.date_input("期限", value=None)
            submit_button = st.form_submit_button("追加する")

            if submit_button:
                if task:
                    # 新しいタスクをリストに追加
                    new_todo = {
                        "task": task,
                        "due_date": due_date.isoformat() if due_date else "",
                        "done": False,
                    }
                    st.session_state.todo_list.append(new_todo)

                    # 【追加】CSVファイルに保存する
                    save_todos(st.session_state.todo_list)

                    st.success(f"「{task}」を追加しました！")
                    # 画面を再起動して即座に反映させる
                    st.rerun()
                else:
                    st.error("タスクを入力してください。")

        # 3. 未完了タスクと完了タスクを分けて表示
        if not st.session_state.todo_list:
            st.info("現在追加されているタスクはありません。")
        else:
            state_changed = False
            weekday_names = (
                "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日", "日曜日"
            )
            todo_items = [
                (i, item, bool(item.get("done", False)))
                for i, item in enumerate(st.session_state.todo_list)
            ]

            for section_title, is_done_section in [
                ("未完了タスク", False),
                ("完了タスク", True),
            ]:
                st.subheader(section_title)
                section_items = [
                    (i, item, was_done)
                    for i, item, was_done in todo_items
                    if was_done == is_done_section
                ]

                if not section_items:
                    st.info("該当するタスクはありません。")
                    continue

                for i, item, was_done in section_items:
                    due_date = item.get("due_date", "")
                    if due_date:
                        try:
                            weekday = weekday_names[pd.Timestamp(due_date).weekday()]
                            deadline_label = f"（期限: {due_date}（{weekday}））"
                        except (TypeError, ValueError):
                            deadline_label = f"（期限: {due_date}）"
                    else:
                        deadline_label = ""
                    task_text = f"{item['task']} {deadline_label}".strip()
                    is_done = st.checkbox(
                        task_text, key=f"todo_{i}", value=was_done
                    )

                    if is_done != was_done:
                        st.session_state.todo_list[i]["done"] = is_done
                        state_changed = True

            if state_changed:
                save_todos(st.session_state.todo_list)
                st.rerun()

    if __name__ == "__main__":
        show_todo()

        # ホームに戻るボタン
    if st.button("⬅️ ホームに戻る", use_container_width=True):
        st.session_state.current_page = "ホーム"
        st.rerun()

elif st.session_state.current_page == "カレンダー":
    st.title("予定カレンダー")

    if "calendar_month" not in st.session_state:
        st.session_state.calendar_month = date.today().replace(day=1)

    previous_column, month_column, next_column = st.columns([1, 3, 1])
    with previous_column:
        if st.button("前の月", use_container_width=True):
            current_month = st.session_state.calendar_month
            if current_month.month == 1:
                st.session_state.calendar_month = date(current_month.year - 1, 12, 1)
            else:
                st.session_state.calendar_month = date(
                    current_month.year, current_month.month - 1, 1
                )
            st.rerun()
    with month_column:
        current_month = st.session_state.calendar_month
        st.subheader(f"{current_month.year}年{current_month.month}月")
    with next_column:
        if st.button("次の月", use_container_width=True):
            current_month = st.session_state.calendar_month
            if current_month.month == 12:
                st.session_state.calendar_month = date(current_month.year + 1, 1, 1)
            else:
                st.session_state.calendar_month = date(
                    current_month.year, current_month.month + 1, 1
                )
            st.rerun()

    todos_by_date = {}
    for item in load_todos():
        due_date = item.get("due_date", "")
        if not due_date:
            continue
        try:
            parsed_date = date.fromisoformat(due_date)
        except ValueError:
            continue
        todos_by_date.setdefault(parsed_date, []).append(item)

    if not todos_by_date:
        st.info("期限が設定されたタスクはありません。")

    weekday_columns = st.columns(7)
    for weekday_index, (column, weekday) in enumerate(
        zip(weekday_columns, ["月", "火", "水", "木", "金", "土", "日"])
    ):
        with column.container(border=True):
            if weekday_index == 5:
                st.markdown(f":blue[**{weekday}**]")
            elif weekday_index == 6:
                st.markdown(f":red[**{weekday}**]")
            else:
                st.markdown(f"**{weekday}**")

    month_calendar = calendar.Calendar(firstweekday=0)
    for week in month_calendar.monthdatescalendar(
        current_month.year, current_month.month
    ):
        day_columns = st.columns(7)
        for column, calendar_day in zip(day_columns, week):
            with column.container(border=True):
                if calendar_day.month == current_month.month:
                    if calendar_day.weekday() == 5:
                        st.markdown(f":blue[**{calendar_day.day}**]")
                    elif calendar_day.weekday() == 6:
                        st.markdown(f":red[**{calendar_day.day}**]")
                    else:
                        st.markdown(f"**{calendar_day.day}**")
                else:
                    st.markdown(f":gray[{calendar_day.day}]")

                for item in todos_by_date.get(calendar_day, []):
                    status = "完了: " if item.get("done", False) else ""
                    st.caption(f"{status}{item['task']}")
