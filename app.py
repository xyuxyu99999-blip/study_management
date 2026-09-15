from flask import Flask
import pandas as pd
import os
import streamlit as st

app = Flask(_name_)
port = int(os.environ.get("PORT", 5000))
app.run(host="0.0.0.0", port=port)

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
page_list = ["ホーム", "定期テスト", "ToDoリスト"]
selected_page = st.sidebar.radio(
    "メニュー",
    page_list,
    index=page_list.index(st.session_state.current_page),
    key="sb_radio",             # サイドバーの状態を記憶するキー
    on_change=on_sidebar_change  # クリックされた瞬間に状態を同期
)


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

    # データを保存するCSVファイルの名前
    TODO_FILE = "todo_list.csv"

    def load_todos():
        """CSVファイルからTodoデータを読み込む関数"""
        if os.path.exists(TODO_FILE):
            # ファイルがあれば読み込む
            return pd.read_csv(TODO_FILE).to_dict(orient="records")
        else:
            # ファイルがなければ空のリストを返す
            return []

    def save_todos(todo_list):
        """TodoデータをCSVファイルに保存する関数"""
        df = pd.DataFrame(todo_list)
        df.to_csv(TODO_FILE, index=False)

    def show_todo():
        st.title("📋 教科別 Todoリスト")

        # 1. データの初期化（CSVから読み込み）
        if "todo_list" not in st.session_state:
            st.session_state.todo_list = load_todos()

        # 2. 入力フォームの作成
        st.subheader("新しいタスクを追加")
        with st.form("todo_form", clear_on_submit=True):
            subject = st.selectbox(
                "教科", ["国語", "数学", "英語", "理科", "社会", "その他"]
            )
            task = st.text_input("すること（タスク）", placeholder="例: ワークのP.20〜25を解く")
            submit_button = st.form_submit_button("追加する")

            if submit_button:
                if task:
                    # 新しいタスクをリストに追加
                    new_todo = {"subject": subject,
                                "task": task, "done": False}
                    st.session_state.todo_list.append(new_todo)

                    # 【追加】CSVファイルに保存する
                    save_todos(st.session_state.todo_list)

                    st.success(f"「[{subject}] {task}」を追加しました！")
                    # 画面を再起動して即座に反映させる
                    st.rerun()
                else:
                    st.error("すること（タスク）を入力してください。")

        # 3. Todoリストの表示
        st.subheader("現在のタスク一覧")

        if not st.session_state.todo_list:
            st.info("現在追加されているタスクはありません。")
        else:
            # チェックボックスの状態が変わったかを監視するためのフラグ
            state_changed = False

            for i, item in enumerate(st.session_state.todo_list):
                task_text = f"**[{item['subject']}]** {item['task']}"

                # 完了チェックボックス
                is_done = st.checkbox(
                    task_text, key=f"todo_{i}", value=item["done"]
                )

                # もしチェック状態が変わったらデータを更新
                if is_done != item["done"]:
                    st.session_state.todo_list[i]["done"] = is_done
                    state_changed = True

            # 【追加】チェックボックスが押されていたらCSVに保存して画面を更新
            if state_changed:
                save_todos(st.session_state.todo_list)
                st.rerun()

    if __name__ == "__main__":
        show_todo()

        # ホームに戻るボタン
    if st.button("⬅️ ホームに戻る", use_container_width=True):
        st.session_state.current_page = "ホーム"
        st.rerun()
