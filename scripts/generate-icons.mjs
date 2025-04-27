import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// 获取当前脚本所在的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..'); // 假设脚本在 scripts 目录下
const inputIconPath = path.join(projectRoot, 'public', 'icon.png');
const outputDir = path.join(projectRoot, 'public', 'icon');
const sizes = [16, 32, 38, 96, 128];

async function generateIcons() {
  try {
    // 检查输入文件是否存在
    if (!fs.existsSync(inputIconPath)) {
      console.error(`错误：输入文件未找到: ${inputIconPath}`);
      process.exit(1);
    }

    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`创建输出目录: ${outputDir}`);
    }

    console.log(`开始生成图标，来源: ${inputIconPath}`);

    // 遍历尺寸并生成图标
    for (const size of sizes) {
      const outputFilename = `${size}.png`;
      const outputPath = path.join(outputDir, outputFilename);

      await sharp(inputIconPath)
        .resize(size, size) // 调整为正方形
        .toFile(outputPath);

      console.log(`✔︎ 已生成: ${outputFilename} (${size}x${size})`);
    }

    console.log('\n✨ 图标生成完毕！');
  } catch (error) {
    console.error('\n❌ 生成图标时出错:');
    console.error(error);
    process.exit(1);
  }
}

// 运行脚本
generateIcons(); 