import { normalizeAnalysis } from '../shared/analysis';
import type { ExamLevel, RawAnalysis, SentenceRecord } from '../shared/types';

interface BuiltinEntry {
  id: string;
  origin: string;
  level: ExamLevel;
  raw: RawAnalysis;
}

const BUILTIN: BuiltinEntry[] = [
  {
    id: 'builtin-2010-1-t1',
    origin: '2010 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        'Of all the changes that have taken place in English-language newspapers during the past quarter-century, perhaps the most far-reaching has been the inexorable decline in the scope and seriousness of their arts coverage.',
      chunks: [
        { text: 'Of all the changes', label: 'prep_phrase', depth: 1, modifies: 'the most far-reaching', explanation: '介词短语，提到句首，限定最高级 the most far-reaching 的比较范围（在所有变化之中）', translation: '在所有变化之中' },
        { text: 'that have taken place in English-language newspapers', label: 'relative_clause', depth: 2, modifies: 'changes', explanation: '定语从句，修饰 changes，that 在从句中作主语', translation: '英文报纸上发生的' },
        { text: 'during the past quarter-century,', label: 'prep_phrase', depth: 3, modifies: 'have taken place', explanation: '介词短语作时间状语，修饰定语从句里的 have taken place', translation: '在过去二十五年间' },
        { text: 'perhaps the most far-reaching has been the inexorable decline', label: 'main', depth: 0, modifies: '', explanation: '主句：最高级 the most far-reaching（最深远的〔变化〕）作主语，has been 是系动词，the inexorable decline 作表语；perhaps 是句首副词', translation: '影响最深远的也许是不可阻挡的衰落' },
        { text: 'in the scope and seriousness of their arts coverage.', label: 'prep_phrase', depth: 1, modifies: 'decline', explanation: '介词短语作后置定语，说明 decline 发生在哪些方面；of their arts coverage 修饰 scope and seriousness', translation: '（其艺术报道）在广度和严肃性上的' },
      ],
      skeleton: { subject: 'the most far-reaching', predicate: 'has been', complement: 'the inexorable decline', summary: '影响最深远的（变化）是不可阻挡的衰落' },
      targets: [
        { word: 'inexorable', form: 'inexorable', pos: 'adj.', meaning: '不可阻挡的；无法改变的', note: '常见搭配 inexorable rise / decline，强调趋势无法逆转' },
        { word: 'far-reaching', form: 'far-reaching', pos: 'adj.', meaning: '影响深远的', note: 'far-reaching consequences / reforms 深远的后果 / 改革' },
      ],
      vocabulary: [
        { form: 'scope', lemma: 'scope', pos: 'n.', meaning: '范围；广度' },
        { form: 'seriousness', lemma: 'seriousness', pos: 'n.', meaning: '严肃性' },
        { form: 'coverage', lemma: 'coverage', pos: 'n.', meaning: '新闻报道' },
      ],
      translation: {
        literal: '在过去二十五年英文报纸所发生的所有变化中，影响最深远的也许是其艺术报道在广度和严肃性上不可阻挡的衰落。',
        fluent: '在过去二十五年英文报纸经历的种种变化中，影响最为深远的恐怕是：艺术报道的广度和严肃性都在无可挽回地下滑。',
      },
      difficulties: [
        '句首 Of all the changes 是表示范围的介词短语，修饰后面的最高级，不是主语。',
        '主语是形容词最高级 the most far-reaching，后面省略了 change；句首副词 perhaps 容易干扰判断。',
        '定语从句和时间状语把主句推到逗号之后，要越过逗号才能找到谓语 has been。',
      ],
    },
  },
  {
    id: 'builtin-2007-1-t1',
    origin: '2007 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        "If you were to examine the birth certificates of every soccer player in 2006's World Cup tournament, you would most likely find a noteworthy quirk: elite soccer players are more likely to have been born in the earlier months of the year than in the later months.",
      chunks: [
        { text: 'If you were to examine the birth certificates', label: 'adverbial_clause', depth: 1, modifies: 'find', explanation: '条件状语从句，were to do 表示对将来的虚拟假设，主句相应用 would find', translation: '如果你去查看出生证明' },
        { text: "of every soccer player in 2006's World Cup tournament,", label: 'prep_phrase', depth: 2, modifies: 'certificates', explanation: "介词短语作后置定语，修饰 certificates；in 2006's World Cup tournament 又修饰 player", translation: '2006 年世界杯每一位足球运动员的' },
        { text: 'you would most likely find a noteworthy quirk:', label: 'main', depth: 0, modifies: '', explanation: '主句：you 主语，would find 是与虚拟条件呼应的谓语，a noteworthy quirk 作宾语；冒号引出对 quirk 的说明', translation: '你很可能会发现一个值得注意的怪现象：' },
        { text: 'elite soccer players are more likely to have been born in the earlier months of the year', label: 'appositive', depth: 1, modifies: 'quirk', explanation: '冒号后的完整句子，具体说明 quirk 是什么，相当于 quirk 的同位语', translation: '顶尖足球运动员更可能出生在一年中靠前的月份' },
        { text: 'than in the later months.', label: 'adverbial_clause', depth: 2, modifies: 'more likely', explanation: '比较状语从句的省略形式，补全为 than (they are likely to have been born) in the later months', translation: '而不是靠后的月份' },
      ],
      skeleton: { subject: 'you', predicate: 'would find', complement: 'a noteworthy quirk', summary: '你会发现一个值得注意的怪现象' },
      targets: [
        { word: 'quirk', form: 'quirk', pos: 'n.', meaning: '怪现象；奇特之处', note: 'a quirk of fate 命运的捉弄；也指人的怪癖' },
        { word: 'noteworthy', form: 'noteworthy', pos: 'adj.', meaning: '值得注意的', note: '= worth noting；同义词 remarkable, notable' },
      ],
      vocabulary: [
        { form: 'certificates', lemma: 'certificate', pos: 'n.', meaning: '证明；证书' },
        { form: 'tournament', lemma: 'tournament', pos: 'n.', meaning: '锦标赛' },
        { form: 'elite', lemma: 'elite', pos: 'adj.', meaning: '顶尖的；精英的' },
      ],
      translation: {
        literal: '如果你去查看 2006 年世界杯每一位足球运动员的出生证明，你很可能会发现一个值得注意的怪现象：顶尖足球运动员更有可能出生在一年中较早的月份，而不是较晚的月份。',
        fluent: '假如你去翻一翻 2006 年世界杯所有球员的出生证明，多半会发现一个耐人寻味的现象：顶尖球员生在上半年的可能性，要比生在下半年大。',
      },
      difficulties: [
        'If you were to examine… 是对将来的虚拟假设，主句相应地用 would find。',
        '冒号后面是一个完整的句子，用来解释 quirk 的具体内容。',
        'than in the later months 是省略的比较结构，补全为 than (they are likely to have been born) in the later months。',
        'to have been born 是不定式的完成被动形式，表示出生发生在过去。',
      ],
    },
  },
  {
    id: 'builtin-2018-1-t1',
    origin: '2018 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        'Among the annoying challenges facing the middle class is one that will probably go unmentioned in the next presidential campaign: What happens when the robots come for their jobs?',
      chunks: [
        { text: 'Among the annoying challenges', label: 'main', depth: 0, modifies: '', explanation: '介词短语作表语，提到句首造成完全倒装（正常语序：One … is among the annoying challenges …）', translation: '在种种恼人的挑战中' },
        { text: 'facing the middle class', label: 'nonfinite_attributive', depth: 1, modifies: 'challenges', explanation: '现在分词短语作后置定语，修饰 challenges（= which face the middle class）', translation: '中产阶级面临的' },
        { text: 'is one', label: 'main', depth: 0, modifies: '', explanation: '倒装后的谓语 is 和真正的主语 one', translation: '有一个' },
        { text: 'that will probably go unmentioned in the next presidential campaign:', label: 'relative_clause', depth: 1, modifies: 'one', explanation: '定语从句，修饰 one，that 在从句中作主语；go unmentioned 是系表结构，意为“不被提及”', translation: '在下届总统竞选中很可能不会被提及的' },
        { text: 'What happens', label: 'appositive', depth: 1, modifies: 'one', explanation: '冒号后的问句具体说明 one 指什么问题，相当于 one 的同位语；What 作主语', translation: '会发生什么' },
        { text: 'when the robots come for their jobs?', label: 'adverbial_clause', depth: 2, modifies: 'happens', explanation: '时间状语从句；come for 意为“冲着……来、来抢”', translation: '当机器人来抢他们的饭碗时' },
      ],
      skeleton: { subject: 'one', predicate: 'is', complement: 'Among the annoying challenges', summary: '（中产阶级面临的）恼人挑战之中有一个（问题）' },
      targets: [
        { word: 'campaign', form: 'campaign', pos: 'n.', meaning: '竞选活动', note: '也指“运动、宣传活动”：an advertising campaign' },
        { word: 'unmentioned', form: 'unmentioned', pos: 'adj.', meaning: '未被提及的', note: 'go unmentioned / unnoticed / unpunished：go + 否定形容词表示“未被……”' },
      ],
      vocabulary: [
        { form: 'annoying', lemma: 'annoying', pos: 'adj.', meaning: '恼人的' },
        { form: 'presidential', lemma: 'presidential', pos: 'adj.', meaning: '总统的' },
      ],
      translation: {
        literal: '在中产阶级面临的种种恼人的挑战中，有一个很可能在下届总统竞选中不会被提及：当机器人来抢他们的工作时会发生什么？',
        fluent: '中产阶级面临着许多恼人的挑战，其中一个在下届总统竞选中多半无人提起：机器人来抢饭碗时，他们怎么办？',
      },
      difficulties: [
        '全句是完全倒装：表语 Among the annoying challenges… 提前，真正的主语是 is 后面的 one。',
        'facing the middle class 是现在分词作后置定语，不是谓语；句子的谓语是 is。',
        '冒号后的问句解释 one 具体指什么问题。',
      ],
    },
  },
  {
    id: 'builtin-2013-1-t1',
    origin: '2013 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        "In the 2006 film version of The Devil Wears Prada, Miranda Priestly, played by Meryl Streep, scolds her unattractive assistant for imagining that high fashion doesn't affect her.",
      chunks: [
        { text: 'In the 2006 film version of The Devil Wears Prada,', label: 'prep_phrase', depth: 1, modifies: 'scolds', explanation: '介词短语作状语，交代场景：在 2006 年版电影《穿普拉达的女王》中', translation: '在 2006 年版电影《穿普拉达的女王》中' },
        { text: 'Miranda Priestly,', label: 'main', depth: 0, modifies: '', explanation: '主句主语', translation: '米兰达·普里斯特利' },
        { text: 'played by Meryl Streep,', label: 'nonfinite_attributive', depth: 1, modifies: 'Miranda Priestly', explanation: '过去分词短语作后置定语，插在主语和谓语之间（= who is played by Meryl Streep）', translation: '由梅丽尔·斯特里普饰演的' },
        { text: 'scolds her unattractive assistant', label: 'main', depth: 0, modifies: '', explanation: '谓语 scolds 和宾语 her unattractive assistant', translation: '斥责她那相貌平平的助手' },
        { text: 'for imagining', label: 'prep_phrase', depth: 1, modifies: 'scolds', explanation: '介词 for + 动名词，说明斥责的原因（scold sb. for doing sth.）', translation: '因为她以为' },
        { text: "that high fashion doesn't affect her.", label: 'object_clause', depth: 2, modifies: 'imagining', explanation: '宾语从句，作动名词 imagining 的宾语；句末的 her 指助手本人', translation: '高端时尚影响不到她' },
      ],
      skeleton: { subject: 'Miranda Priestly', predicate: 'scolds', complement: 'her unattractive assistant', summary: '米兰达斥责她的助手' },
      targets: [
        { word: 'scold', form: 'scolds', pos: 'v.', meaning: '责骂；训斥', note: 'scold sb. for (doing) sth. 因某事责备某人' },
        { word: 'unattractive', form: 'unattractive', pos: 'adj.', meaning: '不好看的；没有吸引力的', note: 'un- 表否定：attractive 有吸引力的' },
      ],
      vocabulary: [{ form: 'version', lemma: 'version', pos: 'n.', meaning: '版本' }],
      translation: {
        literal: '在 2006 年版电影《穿普拉达的女王》中，由梅丽尔·斯特里普饰演的米兰达·普里斯特利斥责她那相貌平平的助手，因为她以为高端时尚影响不到自己。',
        fluent: '在 2006 年的电影《穿普拉达的女王》里，梅丽尔·斯特里普饰演的米兰达训斥自己那位其貌不扬的助手，说她竟以为高端时尚与自己毫不相干。',
      },
      difficulties: [
        'played by Meryl Streep 是过去分词作后置定语，插在主语和谓语之间，不是谓语。',
        'scold sb. for doing sth. 表示“因某事责备某人”，for imagining 说明原因。',
        'that 引导的宾语从句作 imagining 的宾语，与主干无关，翻译时放在最后。',
      ],
    },
  },
  {
    id: 'builtin-2016-1-t1',
    origin: '2016 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        'France, which prides itself as the global innovator of fashion, has decided its fashion industry has lost an absolute right to define physical beauty for women.',
      chunks: [
        { text: 'France,', label: 'main', depth: 0, modifies: '', explanation: '主句主语', translation: '法国' },
        { text: 'which prides itself as the global innovator of fashion,', label: 'relative_clause', depth: 1, modifies: 'France', explanation: '非限制性定语从句，修饰 France，which 作从句主语；pride oneself as… 以……自居', translation: '一向以全球时尚引领者自居的' },
        { text: 'has decided', label: 'main', depth: 0, modifies: '', explanation: '主句谓语', translation: '已经认定' },
        { text: 'its fashion industry has lost an absolute right', label: 'object_clause', depth: 0, modifies: 'has decided', explanation: '宾语从句（省略了引导词 that），作 decided 的宾语', translation: '本国时装业已经失去了绝对的权利' },
        { text: 'to define physical beauty for women.', label: 'nonfinite_attributive', depth: 1, modifies: 'right', explanation: '不定式作后置定语，修饰 right，说明是什么权利', translation: '为女性定义形体美的' },
      ],
      skeleton: { subject: 'France', predicate: 'has decided', complement: 'its fashion industry has lost an absolute right', summary: '法国认定：本国时装业已失去绝对的权利' },
      targets: [
        { word: 'pride', form: 'prides', pos: 'v.', meaning: '以……自豪；以……自居', note: 'pride oneself on / as… = take pride in… = be proud of…' },
        { word: 'innovator', form: 'innovator', pos: 'n.', meaning: '创新者；引领者', note: '同根词 innovate v. 创新，innovation n. 创新' },
      ],
      vocabulary: [
        { form: 'absolute', lemma: 'absolute', pos: 'adj.', meaning: '绝对的' },
        { form: 'physical', lemma: 'physical', pos: 'adj.', meaning: '身体的；形体的' },
      ],
      translation: {
        literal: '一向以全球时尚引领者自居的法国已经认定，其时装业失去了为女性定义形体美的绝对权利。',
        fluent: '法国一向以全球时尚的引领者自居，如今却认定：本国时装业已无权再独断地定义女性的形体之美。',
      },
      difficulties: [
        '主语 France 和谓语 has decided 被非限制性定语从句 which prides itself… 隔开。',
        'decided 后面的宾语从句省略了 that，its fashion industry 是从句的主语。',
        '句中有两个 has：第一个属于主句谓语，第二个属于宾语从句。',
      ],
    },
  },
  {
    id: 'builtin-2012-1-t1',
    origin: '2012 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence: 'That whispered message, half invitation and half forcing, is what most of us think of when we hear the words peer pressure.',
      chunks: [
        { text: 'That whispered message,', label: 'main', depth: 0, modifies: '', explanation: '主句主语；句首 That 是指示代词“那句”，不是连词', translation: '那句悄悄话' },
        { text: 'half invitation and half forcing,', label: 'appositive', depth: 1, modifies: 'message', explanation: '同位语，插在主谓之间，补充说明 message 的性质', translation: '半是邀请、半是强迫' },
        { text: 'is', label: 'main', depth: 0, modifies: '', explanation: '系动词，主句谓语', translation: '就是' },
        { text: 'what most of us think of', label: 'predicative_clause', depth: 0, modifies: 'is', explanation: '表语从句，what 在从句中作 think of 的宾语（我们大多数人想到的东西）', translation: '我们大多数人想到的东西' },
        { text: 'when we hear the words peer pressure.', label: 'adverbial_clause', depth: 1, modifies: 'think of', explanation: '时间状语从句，修饰表语从句里的 think of；peer pressure 是 the words 的同位语', translation: '当我们听到“同伴压力”这个说法时' },
      ],
      skeleton: { subject: 'That whispered message', predicate: 'is', complement: 'what most of us think of', summary: '那句悄悄话就是我们（听到“同伴压力”时）想到的东西' },
      targets: [
        { word: 'whisper', form: 'whispered', pos: 'v.', meaning: '低声说；耳语', note: 'whispered 在这里是过去分词作前置定语：悄声说出的' },
        { word: 'peer', form: 'peer', pos: 'n.', meaning: '同龄人；同伴', note: 'peer pressure 同伴压力；peer review 同行评议' },
      ],
      vocabulary: [
        { form: 'invitation', lemma: 'invitation', pos: 'n.', meaning: '邀请' },
        { form: 'forcing', lemma: 'forcing', pos: 'n.', meaning: '强迫' },
      ],
      translation: {
        literal: '那句悄悄话，半是邀请半是强迫，就是我们大多数人在听到“同伴压力”这个说法时会想到的东西。',
        fluent: '一提起“同伴压力”，我们大多数人想到的就是那句半是邀请、半是胁迫的悄悄话。',
      },
      difficulties: [
        '句首的 That 是指示代词“那句”，修饰 whispered message，不是引导从句的连词。',
        'half invitation and half forcing 是插在主谓之间的同位语。',
        'what 引导表语从句，同时在从句中作 think of 的宾语。',
      ],
    },
  },
  {
    id: 'builtin-2008-1-t1',
    origin: '2008 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence: 'While still catching up to men in some spheres of modern life, women appear to be way ahead in at least one undesirable category.',
      chunks: [
        { text: 'While still catching up to men', label: 'adverbial_clause', depth: 1, modifies: 'appear', explanation: '让步状语从句的省略形式，完整为 While (women are) still catching up to men；while 表示“尽管”', translation: '尽管（女性）仍在追赶男性' },
        { text: 'in some spheres of modern life,', label: 'prep_phrase', depth: 2, modifies: 'catching up', explanation: '介词短语作状语，说明在哪些领域追赶', translation: '在现代生活的某些领域' },
        { text: 'women appear to be way ahead', label: 'main', depth: 0, modifies: '', explanation: '主句：women 主语，appear to be 系表结构（似乎是），way ahead 作表语；way 是副词“远远地”', translation: '女性似乎遥遥领先' },
        { text: 'in at least one undesirable category.', label: 'prep_phrase', depth: 1, modifies: 'ahead', explanation: '介词短语作状语，说明在哪方面领先；at least 修饰 one', translation: '至少在一个不光彩的方面' },
      ],
      skeleton: { subject: 'women', predicate: 'appear to be', complement: 'way ahead', summary: '女性似乎遥遥领先' },
      targets: [
        { word: 'sphere', form: 'spheres', pos: 'n.', meaning: '领域；范围', note: 'sphere of influence 势力范围；public sphere 公共领域' },
        { word: 'undesirable', form: 'undesirable', pos: 'adj.', meaning: '不良的；不受欢迎的', note: 'un- + desirable（值得拥有的）' },
      ],
      vocabulary: [
        { form: 'catching up', lemma: 'catch up', pos: 'v.', meaning: '赶上；追上' },
        { form: 'category', lemma: 'category', pos: 'n.', meaning: '类别；方面' },
      ],
      translation: {
        literal: '尽管在现代生活的某些领域仍在追赶男性，女性在至少一个不良方面似乎遥遥领先。',
        fluent: '尽管女性在现代生活的某些领域仍在奋起直追，但至少在一个并不光彩的方面，她们似乎已经把男性远远甩在了身后。',
      },
      difficulties: [
        'While still catching up… 省略了主语和 be 动词（While women are still catching up…），while 在这里表示让步“尽管”。',
        'way ahead 中的 way 是副词，意为“远远地”，不是名词“道路”。',
        'appear to be 是系表结构，主干是 women appear (to be) way ahead。',
      ],
    },
  },
  {
    id: 'builtin-2009-1-t1',
    origin: '2009 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence: 'We reach for them mindlessly, setting our brains on auto-pilot and relaxing into the unconscious comfort of familiar routine.',
      chunks: [
        { text: 'We reach for them mindlessly,', label: 'main', depth: 0, modifies: '', explanation: '主句：We 主语，reach for 谓语（伸手去拿，引申为依赖），them 宾语（指上一句的 habits），mindlessly 方式状语', translation: '我们不假思索地依赖它们' },
        { text: 'setting our brains on auto-pilot', label: 'nonfinite_adverbial', depth: 1, modifies: 'reach for', explanation: '现在分词短语作伴随状语，逻辑主语是 We', translation: '让大脑进入“自动驾驶”状态' },
        { text: 'and relaxing into the unconscious comfort of familiar routine.', label: 'nonfinite_adverbial', depth: 1, modifies: 'reach for', explanation: '现在分词短语，由 and 与 setting… 并列，同样作伴随状语；of familiar routine 修饰 comfort', translation: '在熟悉的常规中不知不觉地放松下来' },
      ],
      skeleton: { subject: 'We', predicate: 'reach for', complement: 'them', summary: '我们依赖它们（习惯）' },
      targets: [
        { word: 'routine', form: 'routine', pos: 'n.', meaning: '常规；例行公事', note: 'daily routine 日常惯例；也可作形容词 routine check 例行检查' },
        { word: 'unconscious', form: 'unconscious', pos: 'adj.', meaning: '无意识的；不知不觉的', note: '反义词 conscious；unconscious bias 无意识偏见' },
      ],
      vocabulary: [
        { form: 'mindlessly', lemma: 'mindlessly', pos: 'adv.', meaning: '不动脑子地' },
        { form: 'auto-pilot', lemma: 'auto-pilot', pos: 'n.', meaning: '自动驾驶' },
      ],
      translation: {
        literal: '我们不假思索地依赖它们，让大脑处于自动驾驶状态，放松地沉浸在熟悉常规带来的无意识的舒适之中。',
        fluent: '我们会下意识地依赖习惯，让大脑进入“自动驾驶”模式，在熟悉的例行公事中不知不觉地放松下来。',
      },
      difficulties: [
        'setting… 和 relaxing… 是由 and 连接的两个现在分词短语，都作伴随状语，逻辑主语是 We。',
        'them 指上一句的 habits（习惯）；reach for 原义“伸手去拿”，这里引申为“依赖”。',
        'on auto-pilot 是比喻：像开了自动驾驶一样不用动脑。',
      ],
    },
  },
  {
    id: 'builtin-2011-1-t1',
    origin: '2011 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        'The decision of the New York Philharmonic to hire Alan Gilbert as its next music director has been the talk of the classical-music world ever since the sudden announcement of his appointment in 2009.',
      chunks: [
        { text: 'The decision of the New York Philharmonic', label: 'main', depth: 0, modifies: '', explanation: '主语 The decision；of the New York Philharmonic 说明是谁的决定', translation: '纽约爱乐乐团的决定' },
        { text: 'to hire Alan Gilbert as its next music director', label: 'nonfinite_attributive', depth: 1, modifies: 'decision', explanation: '不定式作后置定语，说明 decision 的内容；hire sb. as… 聘请某人担任……', translation: '聘请艾伦·吉尔伯特担任下一任音乐总监的' },
        { text: 'has been the talk of the classical-music world', label: 'main', depth: 0, modifies: '', explanation: '谓语 has been + 表语 the talk（话题）；of the classical-music world 修饰 talk', translation: '一直是古典音乐界的话题' },
        { text: 'ever since the sudden announcement of his appointment in 2009.', label: 'prep_phrase', depth: 1, modifies: 'has been', explanation: 'since 在这里是介词，后接名词短语，作时间状语，与现在完成时 has been 呼应', translation: '自从 2009 年突然宣布对他的任命以来' },
      ],
      skeleton: { subject: 'The decision', predicate: 'has been', complement: 'the talk', summary: '这个决定一直是（古典音乐界的）话题' },
      targets: [
        { word: 'appointment', form: 'appointment', pos: 'n.', meaning: '任命；委任', note: '另一常见义“约会、预约”：make an appointment' },
        { word: 'announcement', form: 'announcement', pos: 'n.', meaning: '宣布；公告', note: '动词 announce 宣布' },
      ],
      vocabulary: [
        { form: 'Philharmonic', lemma: 'philharmonic', pos: 'n.', meaning: '爱乐乐团' },
        { form: 'director', lemma: 'director', pos: 'n.', meaning: '总监；主管' },
      ],
      translation: {
        literal: '纽约爱乐乐团聘请艾伦·吉尔伯特担任其下一任音乐总监的决定，自 2009 年突然宣布对他的任命以来，一直是古典音乐界的话题。',
        fluent: '自 2009 年纽约爱乐乐团突然宣布任命艾伦·吉尔伯特为下一任音乐总监以来，这一决定就一直是古典音乐界热议的话题。',
      },
      difficulties: [
        '主语 The decision 带了两个后置修饰（of the New York Philharmonic 和不定式 to hire…），主语长达 15 个词，谓语 has been 很靠后。',
        'ever since 后面接的是名词短语，since 是介词，整体作时间状语。',
        'the talk of… 意为“……的话题”，talk 在这里是名词。',
      ],
    },
  },
  {
    id: 'builtin-2010-1-t2',
    origin: '2010 考研英语一 Text 2',
    level: 'kaoyan1',
    raw: {
      sentence: 'Over the past decade, thousands of patents have been granted for what are called business methods.',
      chunks: [
        { text: 'Over the past decade,', label: 'prep_phrase', depth: 1, modifies: 'have been granted', explanation: '介词短语作时间状语，与现在完成时呼应', translation: '过去十年间' },
        { text: 'thousands of patents have been granted', label: 'main', depth: 0, modifies: '', explanation: '主句：thousands of patents 作主语，have been granted 是现在完成时的被动语态', translation: '数以千计的专利被授予' },
        { text: 'for what are called business methods.', label: 'object_clause', depth: 1, modifies: 'granted', explanation: '介词 for 后接 what 引导的宾语从句（作介词宾语）；what 在从句中作主语，what are called… 意为“所谓的……”', translation: '给所谓的“商业方法”' },
      ],
      skeleton: { subject: 'thousands of patents', predicate: 'have been granted', complement: '', summary: '数以千计的专利被授予' },
      targets: [
        { word: 'patent', form: 'patents', pos: 'n.', meaning: '专利', note: 'apply for a patent 申请专利；patent law 专利法' },
        { word: 'grant', form: 'granted', pos: 'v.', meaning: '授予；准予', note: 'take sth. for granted 认为……理所当然' },
      ],
      vocabulary: [{ form: 'decade', lemma: 'decade', pos: 'n.', meaning: '十年' }],
      translation: {
        literal: '在过去十年里，数以千计的专利被授予了所谓的商业方法。',
        fluent: '过去十年间，有数千项专利被授予了所谓的“商业方法”。',
      },
      difficulties: [
        'what are called… 意为“所谓的”，what 引导的从句整体作介词 for 的宾语。',
        'have been granted 是现在完成时的被动语态，主语是专利，没有宾语。',
      ],
    },
  },
  {
    id: 'builtin-2017-1-t1',
    origin: '2017 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        'First two hours, now three hours — this is how far in advance authorities are recommending people show up to catch a domestic flight, at least at some major U.S. airports with increasingly massive security lines.',
      chunks: [
        { text: 'First two hours, now three hours —', label: 'appositive', depth: 1, modifies: 'this', explanation: '句首名词短语，由破折号后的 this 复指，相当于 this 的同位语', translation: '先是两小时，现在是三小时——' },
        { text: 'this is', label: 'main', depth: 0, modifies: '', explanation: '主句主语 this（复指句首内容）+ 系动词 is', translation: '这就是' },
        { text: 'how far in advance authorities are recommending', label: 'predicative_clause', depth: 0, modifies: 'is', explanation: 'how 引导表语从句（提前多久）；authorities 是从句主语，are recommending 是谓语', translation: '当局建议提前多久' },
        { text: 'people show up', label: 'object_clause', depth: 1, modifies: 'recommending', explanation: '宾语从句，省略了 that；recommend 后的宾语从句用虚拟语气 (should) show up，should 省略', translation: '人们到达（机场）' },
        { text: 'to catch a domestic flight,', label: 'nonfinite_adverbial', depth: 2, modifies: 'show up', explanation: '不定式作目的状语', translation: '以便赶上国内航班' },
        { text: 'at least at some major U.S. airports', label: 'prep_phrase', depth: 1, modifies: 'recommending', explanation: '介词短语作地点状语，at least 表示“至少”', translation: '至少在美国一些大型机场' },
        { text: 'with increasingly massive security lines.', label: 'prep_phrase', depth: 2, modifies: 'airports', explanation: '介词短语作后置定语，修饰 airports', translation: '安检队伍越来越长的' },
      ],
      skeleton: { subject: 'this', predicate: 'is', complement: 'how far in advance authorities are recommending', summary: '这就是当局建议的提前量' },
      targets: [
        { word: 'authority', form: 'authorities', pos: 'n.', meaning: '当局；官方（常用复数）', note: '单数还可指“权威、权力”：have authority over…' },
        { word: 'domestic', form: 'domestic', pos: 'adj.', meaning: '国内的', note: '另一义“家庭的”：domestic violence 家庭暴力' },
      ],
      vocabulary: [
        { form: 'in advance', lemma: 'in advance', pos: 'phr.', meaning: '提前' },
        { form: 'show up', lemma: 'show up', pos: 'v.', meaning: '出现；到场' },
        { form: 'massive', lemma: 'massive', pos: 'adj.', meaning: '巨大的' },
      ],
      translation: {
        literal: '先是两小时，现在是三小时——这就是当局建议人们为赶上国内航班而提前到达的时间，至少在美国一些安检队伍越来越长的大型机场是这样。',
        fluent: '先是提前两小时，现在是提前三小时——至少在美国一些安检队伍越排越长的大机场，当局就是这样建议乘客为赶国内航班提前到场的。',
      },
      difficulties: [
        '句首 First two hours, now three hours 不是主语，它被破折号后的 this 复指，主干是 this is…。',
        'how far in advance… 引导表语从句；recommending 后的宾语从句省略了 that，并用虚拟语气 (should) show up。',
        'with increasingly massive security lines 修饰 airports，说明这些机场的特点。',
      ],
    },
  },
  {
    id: 'builtin-2014-1-t1',
    origin: '2014 考研英语一 Text 1',
    level: 'kaoyan1',
    raw: {
      sentence:
        "In order to 'change lives for the better' and reduce 'dependency', George Osborne, Chancellor of the Exchequer, introduced the 'upfront work search' scheme.",
      chunks: [
        { text: "In order to 'change lives for the better' and reduce 'dependency',", label: 'nonfinite_adverbial', depth: 1, modifies: 'introduced', explanation: 'in order to 引导目的状语，两个不定式 change… 和 reduce… 由 and 并列', translation: '为了“让生活变得更好”并减少“依赖”' },
        { text: 'George Osborne,', label: 'main', depth: 0, modifies: '', explanation: '主句主语', translation: '乔治·奥斯本' },
        { text: 'Chancellor of the Exchequer,', label: 'appositive', depth: 1, modifies: 'George Osborne', explanation: '同位语，说明 George Osborne 的身份（英国财政大臣）', translation: '财政大臣' },
        { text: "introduced the 'upfront work search' scheme.", label: 'main', depth: 0, modifies: '', explanation: "谓语 introduced + 宾语 the 'upfront work search' scheme", translation: '推出了“预先求职”计划' },
      ],
      skeleton: { subject: 'George Osborne', predicate: 'introduced', complement: "the 'upfront work search' scheme", summary: '乔治·奥斯本推出了（预先求职）计划' },
      targets: [
        { word: 'dependency', form: "'dependency',", pos: 'n.', meaning: '依赖（这里指对福利的依赖）', note: '同根词 dependence n. / dependent adj.' },
        { word: 'scheme', form: 'scheme', pos: 'n.', meaning: '计划；方案', note: '英式英语中常指政府的计划；也有“阴谋”的贬义' },
      ],
      vocabulary: [
        { form: "'upfront", lemma: 'upfront', pos: 'adj.', meaning: '预先的；提前的' },
        { form: 'Exchequer,', lemma: 'exchequer', pos: 'n.', meaning: '（英国）财政部' },
      ],
      translation: {
        literal: '为了“让生活变得更好”并减少“依赖”，财政大臣乔治·奥斯本推出了“预先求职”计划。',
        fluent: '为了“改善民生”、减少“福利依赖”，英国财政大臣乔治·奥斯本推出了“预先求职”计划。',
      },
      difficulties: [
        '句首 In order to… and reduce… 是目的状语，两个不定式由 and 并列。',
        'Chancellor of the Exchequer 是 George Osborne 的同位语，指英国财政大臣，不是谓语。',
      ],
    },
  },
  {
    id: 'builtin-2010-2-t1',
    origin: '2010 考研英语二 Text 1',
    level: 'kaoyan2',
    raw: {
      sentence:
        "The longest bull run in a century of art-market history ended on a dramatic note with a sale of 56 works by Damien Hirst, Beautiful Inside My Head Forever, at Sotheby's in London on September 15th 2008.",
      chunks: [
        { text: 'The longest bull run', label: 'main', depth: 0, modifies: '', explanation: '主句主语（bull run 牛市）', translation: '最长的牛市' },
        { text: 'in a century of art-market history', label: 'prep_phrase', depth: 1, modifies: 'bull run', explanation: '介词短语作后置定语，限定最高级 longest 的范围', translation: '艺术品市场百年历史上' },
        { text: 'ended on a dramatic note', label: 'main', depth: 0, modifies: '', explanation: '谓语 ended；on a dramatic note 是固定表达“以戏剧性的方式”', translation: '戏剧性地结束了' },
        { text: 'with a sale of 56 works by Damien Hirst,', label: 'prep_phrase', depth: 1, modifies: 'ended', explanation: '介词短语作方式状语（以……告终）；of 56 works by Damien Hirst 修饰 sale', translation: '以达米恩·赫斯特 56 件作品的拍卖' },
        { text: 'Beautiful Inside My Head Forever,', label: 'appositive', depth: 2, modifies: 'sale', explanation: '同位语，是这场拍卖（专场）的名称', translation: '（拍卖专场名为《永远美丽在我脑海》）' },
        { text: "at Sotheby's in London on September 15th 2008.", label: 'prep_phrase', depth: 2, modifies: 'sale', explanation: '介词短语，交代拍卖的地点和时间', translation: '2008 年 9 月 15 日在伦敦苏富比拍卖行（举行的）' },
      ],
      skeleton: { subject: 'The longest bull run', predicate: 'ended', complement: '', summary: '最长的牛市结束了' },
      targets: [
        { word: 'dramatic', form: 'dramatic', pos: 'adj.', meaning: '戏剧性的；引人注目的', note: 'on a dramatic note 以戏剧性的方式；dramatic change 巨大的变化' },
      ],
      vocabulary: [{ form: 'bull run', lemma: 'bull run', pos: 'n.', meaning: '牛市' }],
      translation: {
        literal: '艺术品市场百年历史上最长的牛市，以 2008 年 9 月 15 日在伦敦苏富比拍卖达米恩·赫斯特的 56 件作品（专场名为《永远美丽在我脑海》）而戏剧性地结束了。',
        fluent: '2008 年 9 月 15 日，伦敦苏富比拍卖行举行了达米恩·赫斯特 56 件作品的专场拍卖“永远美丽在我脑海”，艺术品市场百年来持续最久的牛市就此戏剧性地落幕。',
      },
      difficulties: [
        '主干很短：The longest bull run … ended；后面一长串都是介词短语，交代方式、地点和时间。',
        'on a dramatic note 是固定表达，意为“以戏剧性的方式（收场）”。',
        'Beautiful Inside My Head Forever 是拍卖专场的名称，作 sale 的同位语。',
      ],
    },
  },
  {
    id: 'builtin-classic-idea',
    origin: '经典长难句',
    level: 'kaoyan2',
    raw: {
      sentence: 'The idea that some groups of people may be more intelligent than others is one of those hypotheses that dare not speak its name.',
      chunks: [
        { text: 'The idea', label: 'main', depth: 0, modifies: '', explanation: '主句主语', translation: '这种观点' },
        { text: 'that some groups of people may be more intelligent than others', label: 'appositive_clause', depth: 1, modifies: 'idea', explanation: '同位语从句，说明 idea 的具体内容；that 在从句中不作成分（从句本身成分齐全）', translation: '某些人群可能比其他人群更聪明' },
        { text: 'is one of those hypotheses', label: 'main', depth: 0, modifies: '', explanation: '谓语 is + 表语 one；of those hypotheses 说明 one 的范围', translation: '是那些假说之一' },
        { text: 'that dare not speak its name.', label: 'relative_clause', depth: 1, modifies: 'hypotheses', explanation: '定语从句，修饰 hypotheses，that 在从句中作主语；dare not speak its name 指不敢公开谈论', translation: '不敢公开说出名字的' },
      ],
      skeleton: { subject: 'The idea', predicate: 'is', complement: 'one', summary: '这种观点是（不便公开谈论的）假说之一' },
      targets: [
        { word: 'hypothesis', form: 'hypotheses', pos: 'n.', meaning: '假说；假设（复数 hypotheses）', note: '-sis 结尾的名词复数变 -ses：analysis → analyses' },
        { word: 'dare', form: 'dare', pos: 'v.', meaning: '敢于', note: '作情态动词时 dare not do；作实义动词时 not dare to do' },
      ],
      vocabulary: [{ form: 'intelligent', lemma: 'intelligent', pos: 'adj.', meaning: '聪明的' }],
      translation: {
        literal: '某些人群可能比其他人群更聪明的观点，是那些不敢说出自己名字的假说之一。',
        fluent: '“某些人群可能比其他人群更聪明”——这种观点属于那类不便公开谈论的假说。',
      },
      difficulties: [
        '两个 that 作用不同：第一个引导同位语从句（不作成分），第二个引导定语从句（作主语）。',
        '同位语从句很长，把主语 The idea 和谓语 is 隔开了。',
      ],
    },
  },
  {
    id: 'builtin-warmup-phones',
    origin: '入门示例',
    level: 'cet4',
    raw: {
      sentence: 'Many people find it difficult to stop looking at their phones, even when they are trying to focus on something else.',
      chunks: [
        { text: 'Many people find it difficult', label: 'main', depth: 0, modifies: '', explanation: '主句：Many people 主语，find 谓语，it 是形式宾语，difficult 是宾语补足语', translation: '许多人发现很难' },
        { text: 'to stop looking at their phones,', label: 'main', depth: 0, modifies: '', explanation: '不定式短语是真正的宾语（it 指代它）', translation: '停下来不看手机' },
        { text: 'even when they are trying to focus on something else.', label: 'adverbial_clause', depth: 1, modifies: 'find', explanation: '状语从句，even when 意为“即使在……的时候”', translation: '即使在他们努力专注于别的事情时' },
      ],
      skeleton: { subject: 'Many people', predicate: 'find', complement: 'it difficult to stop looking at their phones', summary: '许多人发现很难停止看手机' },
      targets: [{ word: 'focus', form: 'focus', pos: 'v.', meaning: '集中（注意力）', note: 'focus on… 专注于……；也可作名词 the focus of attention' }],
      vocabulary: [],
      translation: {
        literal: '许多人发现很难停止看他们的手机，即使在他们正努力专注于其他事情的时候。',
        fluent: '很多人都发现自己很难放下手机，哪怕正努力想专心做别的事。',
      },
      difficulties: [
        'find it + 形容词 + to do 中，it 是形式宾语，真正的宾语是后面的不定式。',
        'even when 引导的状语从句表示让步兼时间：即使在……时候。',
      ],
    },
  },
];

export const BUILTIN_RECORDS: SentenceRecord[] = BUILTIN.map((entry) => {
  const result = normalizeAnalysis(entry.raw);
  if (!result.ok) throw new Error(`内置句子 ${entry.id} 无法对齐：${result.errors.join('；')}`);
  return {
    id: entry.id,
    source: 'builtin',
    origin: entry.origin,
    level: entry.level,
    createdAt: '2026-10-17T00:00:00.000Z',
    analysis: result.analysis,
  };
});
