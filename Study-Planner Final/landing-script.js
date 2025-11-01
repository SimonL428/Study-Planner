document.addEventListener('DOMContentLoaded', () => {
    // 获取 "Start Now" 按钮和文本输入框
    const startButton = document.getElementById('start-button');
    const promptTextarea = document.getElementById('prompt-textarea');

    // 为按钮添加点击事件监听器
    startButton.addEventListener('click', () => {
        const inputText = promptTextarea.value.trim();

        // 检查用户是否输入了内容
        if (inputText) {
            // 对文本进行URL编码，以防止特殊字符破坏URL结构
            const encodedText = encodeURIComponent(inputText);
            
            // 构建指向主应用页的URL，并将文本作为 'prompt' 参数附加
            const targetUrl = `conversation_page.html?prompt=${encodedText}`;
            
            // 指示浏览器跳转到新页面
            window.location.href = targetUrl;
        } else {
            // 如果输入框为空，则提醒用户
            alert('Please enter some text to summarize.');
        }
    });
});