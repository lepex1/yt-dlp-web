const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs');
const path = require('path');
const os = require('os');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { url, quality, noAudio } = req.body;
    
    if (!url) {
        return res.status(400).send('URL is required');
    }

    try {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-dlp-'));
        
        // Пути к бинарникам (относительно расположения файла)
        const __dirname = path.dirname(new URL(import.meta.url).pathname;
        const baseDir = path.join(__dirname, '..', 'yt-dlp');
        const ytDlpPath = path.join(baseDir, 'yt-dlp.exe');
        const ffmpegPath = path.join(baseDir, 'ffmpeg.exe');
        
        // Формируем параметры
        let format = '';
        if (noAudio) {
            format = quality === 'best' ? 'bestvideo' : 'worstvideo';
        } else {
            format = quality === 'best' ? 'bestvideo+bestaudio' : 'worstvideo+worstaudio/worst';
        }

        const outputTemplate = path.join(tempDir, '%(title)s.%(ext)s');
        
        // Команда с использованием локальных бинарников
        const command = `"${ytDlpPath}" -f "${format}" --ffmpeg-location "${path.dirname(ffmpegPath)}" --remux-video mp4 -o "${outputTemplate}" "${url}"`;

        // Запускаем yt-dlp
        await execAsync(command, { timeout: 300000 });

        // Поиск скачанного файла
        const files = fs.readdirSync(tempDir);
        if (files.length === 0) {
            throw new Error('Файл не найден после скачивания');
        }

        const videoPath = path.join(tempDir, files[0]);
        const videoStream = fs.createReadStream(videoPath);

        // Определяем MIME-тип
        const ext = path.extname(videoPath).toLowerCase();
        const mimeTypes = {
            '.mp4': 'video/mp4',
            '.mkv': 'video/x-matroska',
            '.webm': 'video/webm',
            '.avi': 'video/x-msvideo'
        };

        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${files[0]}"`);
        
        videoStream.pipe(res);

        // Удаление временных файлов после отправки
        videoStream.on('end', () => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

    } catch (error) {
        console.error('Ошибка:', error);
        res.status(500).send(error.message);
    }

};
