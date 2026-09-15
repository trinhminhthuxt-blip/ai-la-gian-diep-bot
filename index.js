const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const games = new Map();

const pairs = [
  ["mặt trăng", "mặt trời"],
  ["pizza", "hamburger"],
  ["mèo", "hổ"],
  ["chó", "sói"],
  ["biển", "hồ"],
  ["phở", "bún"],
  ["điện thoại", "máy tính"],
  ["bút chì", "bút mực"],
  ["trường học", "thư viện"],
  ["sân bay", "nhà ga"],
  ["kem", "sữa chua"],
  ["bóng đá", "bóng rổ"],
  ["mưa", "tuyết"],
  ["cây", "hoa"],
  ["xe đạp", "xe máy"],
  ["gương", "cửa sổ"]
];

const commands = [
  new SlashCommandBuilder()
    .setName("spy")
    .setDescription("Chơi Ai Là Gián Điệp")
    .addSubcommand(sub =>
      sub
        .setName("start")
        .setDescription("Tạo ván mới")
        .addIntegerOption(option =>
          option
            .setName("so_nguoi")
            .setDescription("Số người chơi")
            .setMinValue(4)
            .setMaxValue(20)
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName("join").setDescription("Tham gia ván")
    )
    .addSubcommand(sub =>
      sub.setName("begin").setDescription("Bắt đầu ván")
    )
].map(command => command.toJSON());

client.once("ready", async () => {
  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN
  );

  await rest.put(
    Routes.applicationCommands(client.user.id),
    { body: commands }
  );

  console.log(`Bot online: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand() && interaction.commandName === "spy") {
    const guildId = interaction.guildId;
    const sub = interaction.options.getSubcommand();

    if (sub === "start") {
      const maxPlayers = interaction.options.getInteger("so_nguoi");

      games.set(guildId, {
        max: maxPlayers,
        players: new Map(),
        started: false,
        votes: new Map()
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("join")
          .setLabel("🎮 Tham gia")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("begin")
          .setLabel("▶️ Bắt đầu")
          .setStyle(ButtonStyle.Primary)
      );

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🕵️ AI LÀ GIÁN ĐIỆP?")
            .setDescription(
              `Ván mới! Tối đa **${maxPlayers} người**.\n\n` +
              `Bấm **🎮 Tham gia**, sau đó bấm **▶️ Bắt đầu**.`
            )
        ],
        components: [row]
      });
    }

    const game = games.get(guildId);

    if (!game) {
      return interaction.reply({
        content: "Chưa có ván. Dùng `/spy start`.",
        ephemeral: true
      });
    }

    if (sub === "join") {
      return joinGame(interaction, game);
    }

    if (sub === "begin") {
      return beginGame(interaction, game);
    }
  }

  if (interaction.isButton()) {
    const game = games.get(interaction.guildId);

    if (!game) {
      return interaction.reply({
        content: "Không có ván nào đang chơi.",
        ephemeral: true
      });
    }

    if (interaction.customId === "join") {
      return joinGame(interaction, game);
    }

    if (interaction.customId === "begin") {
      return beginGame(interaction, game);
    }

    if (interaction.customId.startsWith("vote_")) {
      return vote(interaction, game, interaction.customId.slice(5));
    }
  }
});

function joinGame(interaction, game) {
  if (game.started) {
    return interaction.reply({
      content: "Ván đã bắt đầu rồi!",
      ephemeral: true
    });
  }

  if (game.players.has(interaction.user.id)) {
    return interaction.reply({
      content: "Bạn đã tham gia rồi!",
      ephemeral: true
    });
  }

  if (game.players.size >= game.max) {
    return interaction.reply({
      content: "Ván đã đủ người!",
      ephemeral: true
    });
  }

  game.players.set(
    interaction.user.id,
    interaction.user.username
  );

  return interaction.reply({
    content:
      `✅ ${interaction.user.username} đã tham gia ` +
      `(${game.players.size}/${game.max})`
  });
}

async function beginGame(interaction, game) {
  if (game.started) {
    return interaction.reply({
      content: "Ván đã bắt đầu!",
      ephemeral: true
    });
  }

  if (game.players.size < 4) {
    return interaction.reply({
      content: "Cần ít nhất 4 người để bắt đầu!",
      ephemeral: true
    });
  }

  game.started = true;

  const playerIds = [...game.players.keys()];

  game.spy =
    playerIds[Math.floor(Math.random() * playerIds.length)];

  const pair =
    pairs[Math.floor(Math.random() * pairs.length)];

  game.word = pair[0];

  for (const id of playerIds) {
    try {
      const user = await client.users.fetch(id);

      if (id === game.spy) {
        await user.send(
          "🕵️ BẠN LÀ GIÁN ĐIỆP!\n\n" +
          "Bạn không được nhận từ khóa.\n" +
          "Hãy suy luận và cố gắng không bị phát hiện!"
        );
      } else {
        await user.send(
          `🔑 TỪ KHÓA CỦA BẠN: **${game.word}**\n\n` +
          "Hãy đưa ra gợi ý nhưng đừng nói thẳng từ khóa."
        );
      }
    } catch (error) {
      console.log(`Không thể gửi DM cho ${id}`);
    }
  }

  const row = new ActionRowBuilder();

  for (const id of playerIds) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`vote_${id}`)
        .setLabel(game.players.get(id))
        .setStyle(ButtonStyle.Secondary)
    );
  }

  return interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("🔥 VÁN ĐÃ BẮT ĐẦU!")
        .setDescription(
          "📩 Bot đã gửi vai bí mật qua DM.\n\n" +
          "💬 Mọi người lần lượt đưa ra gợi ý.\n\n" +
          "🗳️ Sau đó chọn người mà bạn nghi là gián điệp."
        )
    ],
    components: [row]
  });
}

async function vote(interaction, game, targetId) {
  if (!game.players.has(interaction.user.id)) {
    return interaction.reply({
      content: "Bạn không tham gia ván này.",
      ephemeral: true
    });
  }

  if (game.votes.has(interaction.user.id)) {
    return interaction.reply({
      content: "Bạn đã bỏ phiếu rồi!",
      ephemeral: true
    });
  }

  game.votes.set(interaction.user.id, targetId);

  await interaction.reply({
    content: "🗳️ Đã ghi nhận phiếu!",
    ephemeral: true
  });

  if (game.votes.size === game.players.size) {
    const counts = {};

    for (const target of game.votes.values()) {
      counts[target] = (counts[target] || 0) + 1;
    }

    const maxVotes = Math.max(...Object.values(counts));

    const topPlayers = Object.keys(counts).filter(
      id => counts[id] === maxVotes
    );

    const caught =
      topPlayers.length === 1 &&
      topPlayers[0] === game.spy;

    await interaction.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("📢 KẾT QUẢ")
          .setDescription(
            caught
              ? `🎉 **BẮT ĐÚNG GIÁN ĐIỆP!**\n\n` +
                `🕵️ Gián điệp: **${game.players.get(game.spy)}**\n\n` +
                `🏆 Phe người thường thắng!`
              : `😱 **GIÁN ĐIỆP ĐÃ THOÁT!**\n\n` +
                `🕵️ Gián điệp: **${game.players.get(game.spy)}**\n\n` +
                `🏆 Gián điệp thắng!`
          )
      ]
    });

    games.delete(interaction.guildId);
  }
}

client.login(process.env.DISCORD_TOKEN);
