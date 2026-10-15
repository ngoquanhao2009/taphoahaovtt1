const shareButton = document.querySelector('[data-share]');
const toast = document.querySelector('.toast');
const copyCodeButton = document.querySelector('[data-copy-code]');

document.addEventListener('dragstart', (event) => event.preventDefault());

copyCodeButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(copyCodeButton.dataset.copyCode);
    toast.textContent = 'Đã sao chép mã HAOVTT1';
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2200);
  } catch (error) {
    console.error('Không thể sao chép mã:', error);
  }
});

shareButton.addEventListener('click', async () => {
  const shareData = { title: 'Hào VTT | Dịch vụ Roblox', url: window.location.href };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.classList.add('show');
      window.setTimeout(() => toast.classList.remove('show'), 2200);
    }
  } catch (error) {
    if (error.name !== 'AbortError') console.error('Không thể chia sẻ liên kết:', error);
  }
});