/**
 * 人民币大写转换 — 各语言工具类示例（与本工具页双向规则一致）
 */
(function (global) {
    "use strict";

    var JS =
        "/** 阿拉伯数字 ↔ 大写人民币（与本工具页规则一致） */\n" +
        "const CN_NUM = ['零','壹','贰','叁','肆','伍','陆','柒','捌','玖'];\n" +
        "const CN_UNIT = ['','拾','佰','仟'];\n" +
        "const CN_SEC = ['','万','亿','兆'];\n" +
        "const CN_DIGIT_MAP = { 零:0, 〇:0, 壹:1, 一:1, 贰:2, 二:2, 两:2, 叁:3, 三:3, 肆:4, 四:4,\n" +
        "  伍:5, 五:5, 陆:6, 六:6, 柒:7, 七:7, 捌:8, 八:8, 玖:9, 九:9 };\n" +
        "const CN_UNIT_MAP = { 拾:10, 十:10, 佰:100, 百:100, 仟:1000, 千:1000,\n" +
        "  万:10000, 萬:10000, 亿:1e8, 億:1e8, 兆:1e15 };\n" +
        "const CN_SECTION_UNITS = [1e4, 1e8, 1e15];\n\n" +
        "function normalizeInput(raw) {\n" +
        "  return String(raw || '').trim().replace(/,/g, '').replace(/\\s+/g, '');\n" +
        "}\n" +
        "function normalizeUpperInput(raw) {\n" +
        "  return String(raw || '').trim().replace(/\\s+/g, '').replace(/,/g, '')\n" +
        "    .replace(/[（）()]/g, '').replace(/^人民币/, '');\n" +
        "}\n\n" +
        "function convertSection(section) {\n" +
        "  let str = '', zero = true, unitPos = 0;\n" +
        "  while (section > 0) {\n" +
        "    const v = section % 10;\n" +
        "    if (v === 0) { if (!zero && unitPos > 0) str = CN_NUM[0] + str; zero = true; }\n" +
        "    else { str = CN_NUM[v] + CN_UNIT[unitPos] + str; zero = false; }\n" +
        "    unitPos++; section = Math.floor(section / 10);\n" +
        "  }\n" +
        "  return str;\n" +
        "}\n" +
        "function convertInteger(n) {\n" +
        "  if (n === 0) return '';\n" +
        "  let str = '', secIndex = 0, needZero = false;\n" +
        "  while (n > 0) {\n" +
        "    const section = n % 10000;\n" +
        "    if (needZero && section > 0 && section < 1000) str = CN_NUM[0] + str;\n" +
        "    const sectionStr = convertSection(section);\n" +
        "    if (section > 0) { str = sectionStr + CN_SEC[secIndex] + str; needZero = section < 1000; }\n" +
        "    else if (str) needZero = true;\n" +
        "    n = Math.floor(n / 10000); secIndex++;\n" +
        "  }\n" +
        "  return str;\n" +
        "}\n" +
        "function polish(s) {\n" +
        "  return s.replace(/零+/g, '零').replace(/零([万亿兆])/g, '$1')\n" +
        "    .replace(/([壹贰叁肆伍陆柒捌玖拾佰仟万亿兆]+)零元/g, '$1元')\n" +
        "    .replace(/零角/g, '').replace(/零分$/, '').replace(/亿万/g, '亿');\n" +
        "}\n\n" +
        "/** 1234.56 → 壹仟贰佰叁拾肆元伍角陆分 */\n" +
        "function toRmbUppercase(raw) {\n" +
        "  let s = normalizeInput(raw);\n" +
        "  if (!s) throw new Error('请输入金额');\n" +
        "  let negative = false;\n" +
        "  if (s[0] === '-') { negative = true; s = s.slice(1); }\n" +
        "  else if (s[0] === '+') s = s.slice(1);\n" +
        "  if (!/^\\d+(\\.\\d+)?$/.test(s)) throw new Error('格式无效');\n" +
        "  const [intPart, frac = ''] = s.split('.');\n" +
        "  if (intPart.length > 15) throw new Error('整数部分不能超过 15 位');\n" +
        "  if (frac.length > 2) throw new Error('小数位最多 2 位');\n" +
        "  const num = Math.round(Number(s) * 100) / 100;\n" +
        "  if (num === 0) return CN_NUM[0] + '元整';\n" +
        "  const abs = Math.abs(num);\n" +
        "  const [iStr, fStr] = abs.toFixed(2).split('.');\n" +
        "  const intVal = parseInt(iStr, 10), jiao = +fStr[0], fen = +fStr[1];\n" +
        "  let result = intVal > 0 ? convertInteger(intVal) + '元' : CN_NUM[0] + '元';\n" +
        "  if (jiao === 0 && fen === 0) result += '整';\n" +
        "  else {\n" +
        "    if (jiao > 0) result += CN_NUM[jiao] + '角';\n" +
        "    if (fen > 0) { if (jiao === 0 && intVal > 0) result += CN_NUM[0]; result += CN_NUM[fen] + '分'; }\n" +
        "  }\n" +
        "  result = polish(result);\n" +
        "  return negative ? '负' + result : result;\n" +
        "}\n\n" +
        "function parseChineseInteger(str) {\n" +
        "  if (!str || str === '零' || str === '〇') return 0;\n" +
        "  let total = 0, section = 0, number = 0;\n" +
        "  for (const ch of str) {\n" +
        "    if (ch === '零' || ch === '〇') continue;\n" +
        "    if (CN_DIGIT_MAP[ch] != null) number = CN_DIGIT_MAP[ch];\n" +
        "    else if (CN_UNIT_MAP[ch] != null) {\n" +
        "      const unit = CN_UNIT_MAP[ch];\n" +
        "      if (CN_SECTION_UNITS.includes(unit)) {\n" +
        "        section = (section + number) * unit; total += section; section = 0; number = 0;\n" +
        "      } else { if (number === 0) number = 1; section += number * unit; number = 0; }\n" +
        "    } else return NaN;\n" +
        "  }\n" +
        "  return total + section + number;\n" +
        "}\n" +
        "function parseSubAmountPart(part) {\n" +
        "  if (!part || part === '零' || part === '〇') return 0;\n" +
        "  const n = parseChineseInteger(part);\n" +
        "  return !Number.isFinite(n) || n < 0 || n > 9 ? NaN : n;\n" +
        "}\n" +
        "function formatArabicAmount(num) {\n" +
        "  const negative = num < 0;\n" +
        "  const cents = Math.round(Math.abs(num) * 100);\n" +
        "  const intPart = Math.floor(cents / 100);\n" +
        "  const jiao = Math.floor((cents % 100) / 10), fen = cents % 10;\n" +
        "  let out = String(intPart);\n" +
        "  if (jiao > 0 || fen > 0) { out += '.'; out += fen > 0 ? String(jiao) + String(fen) : String(jiao); }\n" +
        "  return (negative ? '-' : '') + out;\n" +
        "}\n\n" +
        "/** 壹仟贰佰叁拾肆元伍角陆分 → 1234.56 */\n" +
        "function fromRmbUppercase(raw) {\n" +
        "  let s = normalizeUpperInput(raw);\n" +
        "  if (!s) throw new Error('请输入大写金额');\n" +
        "  let negative = false;\n" +
        "  if (s[0] === '负' || s[0] === '負') { negative = true; s = s.slice(1); }\n" +
        "  if (!s) throw new Error('大写金额格式无效');\n" +
        "  if (s.endsWith('整')) s = s.slice(0, -1);\n" +
        "  const yuanIdx = [...s].findIndex(c => c === '元' || c === '圆');\n" +
        "  let intStr = '', fracStr = '';\n" +
        "  if (yuanIdx >= 0) { intStr = s.slice(0, yuanIdx); fracStr = s.slice(yuanIdx + 1); }\n" +
        "  else if (/角|分/.test(s)) fracStr = s;\n" +
        "  else intStr = s;\n" +
        "  let intVal = 0;\n" +
        "  if (intStr && intStr !== '零' && intStr !== '〇') {\n" +
        "    intVal = parseChineseInteger(intStr);\n" +
        "    if (!Number.isFinite(intVal)) throw new Error('大写金额格式无效');\n" +
        "  }\n" +
        "  let jiao = 0, fen = 0;\n" +
        "  if (fracStr) {\n" +
        "    const jiaoIdx = fracStr.indexOf('角'), fenIdx = fracStr.indexOf('分');\n" +
        "    if (jiaoIdx >= 0) {\n" +
        "      jiao = parseSubAmountPart(fracStr.slice(0, jiaoIdx));\n" +
        "      if (!Number.isFinite(jiao)) throw new Error('角位格式无效');\n" +
        "    }\n" +
        "    if (fenIdx >= 0) {\n" +
        "      const fStart = jiaoIdx >= 0 ? jiaoIdx + 1 : 0;\n" +
        "      fen = parseSubAmountPart(fracStr.slice(fStart, fenIdx));\n" +
        "      if (!Number.isFinite(fen)) throw new Error('分位格式无效');\n" +
        "    }\n" +
        "    const tail = fracStr.slice(fenIdx >= 0 ? fenIdx + 1 : jiaoIdx >= 0 ? jiaoIdx + 1 : 0);\n" +
        "    if (tail && tail !== '零' && tail !== '〇') throw new Error('大写金额格式无效');\n" +
        "  }\n" +
        "  let num = intVal + jiao * 0.1 + fen * 0.01;\n" +
        "  if (negative) num = -num;\n" +
        "  num = Math.round(num * 100) / 100;\n" +
        "  if (!Number.isFinite(num)) throw new Error('大写金额格式无效');\n" +
        "  if (String(Math.floor(Math.abs(num))).length > 15) throw new Error('整数部分不能超过 15 位');\n" +
        "  return formatArabicAmount(num);\n" +
        "}\n\n" +
        "module.exports = { toRmbUppercase, fromRmbUppercase };";

    var JAVA =
        "import java.math.BigDecimal;\n" +
        "import java.math.RoundingMode;\n" +
        "import java.util.HashMap;\n" +
        "import java.util.Map;\n\n" +
        "/** 阿拉伯数字 ↔ 大写人民币（亦可用 Hutool NumberChineseFormatter） */\n" +
        "public final class RmbUppercaseUtils {\n\n" +
        "    private static final String[] CN_NUM =\n" +
        "            {\"零\",\"壹\",\"贰\",\"叁\",\"肆\",\"伍\",\"陆\",\"柒\",\"捌\",\"玖\"};\n" +
        "    private static final String[] CN_UNIT = {\"\",\"拾\",\"佰\",\"仟\"};\n" +
        "    private static final String[] CN_SEC = {\"\",\"万\",\"亿\",\"兆\"};\n" +
        "    private static final Map<Character, Integer> CN_DIGIT_MAP = new HashMap<>();\n" +
        "    private static final Map<Character, Long> CN_UNIT_MAP = new HashMap<>();\n" +
        "    private static final long[] CN_SECTION_UNITS = {10000L, 100000000L, 1000000000000000L};\n\n" +
        "    static {\n" +
        "        String digits = \"零〇壹一贰二两二叁三肆四伍五陆六柒七捌八玖九\";\n" +
        "        int[] vals = {0,0,1,1,2,2,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9};\n" +
        "        for (int i = 0; i < digits.length(); i++) CN_DIGIT_MAP.put(digits.charAt(i), vals[i]);\n" +
        "        CN_UNIT_MAP.put('拾', 10L); CN_UNIT_MAP.put('十', 10L);\n" +
        "        CN_UNIT_MAP.put('佰', 100L); CN_UNIT_MAP.put('百', 100L);\n" +
        "        CN_UNIT_MAP.put('仟', 1000L); CN_UNIT_MAP.put('千', 1000L);\n" +
        "        CN_UNIT_MAP.put('万', 10000L); CN_UNIT_MAP.put('萬', 10000L);\n" +
        "        CN_UNIT_MAP.put('亿', 100000000L); CN_UNIT_MAP.put('億', 100000000L);\n" +
        "        CN_UNIT_MAP.put('兆', 1000000000000000L);\n" +
        "    }\n\n" +
        "    private RmbUppercaseUtils() {}\n\n" +
        "    /** 1234.56 → 壹仟贰佰叁拾肆元伍角陆分 */\n" +
        "    public static String toUppercase(String amount) {\n" +
        "        String s = amount == null ? \"\" : amount.trim().replace(\",\", \"\");\n" +
        "        if (s.isEmpty()) throw new IllegalArgumentException(\"请输入金额\");\n" +
        "        boolean negative = false;\n" +
        "        if (s.startsWith(\"-\")) { negative = true; s = s.substring(1); }\n" +
        "        else if (s.startsWith(\"+\")) s = s.substring(1);\n" +
        "        if (!s.matches(\"\\\\d+(\\\\.\\\\d+)?\")) throw new IllegalArgumentException(\"格式无效\");\n" +
        "        String[] parts = s.split(\"\\\\.\", 2);\n" +
        "        if (parts[0].length() > 15) throw new IllegalArgumentException(\"整数部分不能超过 15 位\");\n" +
        "        if (parts.length > 1 && parts[1].length() > 2) throw new IllegalArgumentException(\"小数位最多 2 位\");\n" +
        "        BigDecimal num = new BigDecimal(s).setScale(2, RoundingMode.HALF_UP);\n" +
        "        if (num.signum() == 0) return CN_NUM[0] + \"元整\";\n" +
        "        num = num.abs();\n" +
        "        long intVal = num.longValue();\n" +
        "        int cents = num.multiply(BigDecimal.valueOf(100)).intValue();\n" +
        "        int jiao = (cents % 100) / 10, fen = cents % 10;\n" +
        "        StringBuilder result = new StringBuilder();\n" +
        "        result.append(intVal > 0 ? convertInteger(intVal) + \"元\" : CN_NUM[0] + \"元\");\n" +
        "        if (jiao == 0 && fen == 0) result.append(\"整\");\n" +
        "        else {\n" +
        "            if (jiao > 0) result.append(CN_NUM[jiao]).append(\"角\");\n" +
        "            if (fen > 0) {\n" +
        "                if (jiao == 0 && intVal > 0) result.append(CN_NUM[0]);\n" +
        "                result.append(CN_NUM[fen]).append(\"分\");\n" +
        "            }\n" +
        "        }\n" +
        "        String out = polish(result.toString());\n" +
        "        return negative ? \"负\" + out : out;\n" +
        "    }\n\n" +
        "    /** 壹仟贰佰叁拾肆元伍角陆分 → 1234.56 */\n" +
        "    public static String toArabic(String upper) {\n" +
        "        String s = normalizeUpperInput(upper);\n" +
        "        if (s.isEmpty()) throw new IllegalArgumentException(\"请输入大写金额\");\n" +
        "        boolean negative = false;\n" +
        "        if (s.startsWith(\"负\") || s.startsWith(\"負\")) { negative = true; s = s.substring(1); }\n" +
        "        if (s.isEmpty()) throw new IllegalArgumentException(\"大写金额格式无效\");\n" +
        "        if (s.endsWith(\"整\")) s = s.substring(0, s.length() - 1);\n" +
        "        int yuanIdx = -1;\n" +
        "        for (int i = 0; i < s.length(); i++) {\n" +
        "            char c = s.charAt(i);\n" +
        "            if (c == '元' || c == '圆') { yuanIdx = i; break; }\n" +
        "        }\n" +
        "        String intStr = \"\", fracStr = \"\";\n" +
        "        if (yuanIdx >= 0) { intStr = s.substring(0, yuanIdx); fracStr = s.substring(yuanIdx + 1); }\n" +
        "        else if (s.contains(\"角\") || s.contains(\"分\")) fracStr = s;\n" +
        "        else intStr = s;\n" +
        "        long intVal = 0;\n" +
        "        if (!intStr.isEmpty() && !\"零\".equals(intStr) && !\"〇\".equals(intStr)) {\n" +
        "            intVal = parseChineseInteger(intStr);\n" +
        "            if (intVal < 0) throw new IllegalArgumentException(\"大写金额格式无效\");\n" +
        "        }\n" +
        "        int jiao = 0, fen = 0;\n" +
        "        if (!fracStr.isEmpty()) {\n" +
        "            int jiaoIdx = fracStr.indexOf('角'), fenIdx = fracStr.indexOf('分');\n" +
        "            if (jiaoIdx >= 0) {\n" +
        "                jiao = parseSubAmountPart(fracStr.substring(0, jiaoIdx));\n" +
        "                if (jiao < 0) throw new IllegalArgumentException(\"角位格式无效\");\n" +
        "            }\n" +
        "            if (fenIdx >= 0) {\n" +
        "                int fStart = jiaoIdx >= 0 ? jiaoIdx + 1 : 0;\n" +
        "                fen = parseSubAmountPart(fracStr.substring(fStart, fenIdx));\n" +
        "                if (fen < 0) throw new IllegalArgumentException(\"分位格式无效\");\n" +
        "            }\n" +
        "            int tailStart = fenIdx >= 0 ? fenIdx + 1 : (jiaoIdx >= 0 ? jiaoIdx + 1 : 0);\n" +
        "            String tail = fracStr.substring(tailStart);\n" +
        "            if (!tail.isEmpty() && !\"零\".equals(tail) && !\"〇\".equals(tail))\n" +
        "                throw new IllegalArgumentException(\"大写金额格式无效\");\n" +
        "        }\n" +
        "        BigDecimal num = BigDecimal.valueOf(intVal)\n" +
        "                .add(BigDecimal.valueOf(jiao, 1)).add(BigDecimal.valueOf(fen, 2));\n" +
        "        if (negative) num = num.negate();\n" +
        "        num = num.setScale(2, RoundingMode.HALF_UP);\n" +
        "        if (String.valueOf(num.abs().longValue()).length() > 15)\n" +
        "            throw new IllegalArgumentException(\"整数部分不能超过 15 位\");\n" +
        "        return formatArabicAmount(num);\n" +
        "    }\n\n" +
        "    private static String normalizeUpperInput(String raw) {\n" +
        "        if (raw == null) return \"\";\n" +
        "        return raw.trim().replaceAll(\"\\\\s+\", \"\").replace(\",\", \"\")\n" +
        "                .replaceAll(\"[（）()]\", \"\").replaceFirst(\"^人民币\", \"\");\n" +
        "    }\n\n" +
        "    private static long parseChineseInteger(String str) {\n" +
        "        if (str == null || str.isEmpty() || \"零\".equals(str) || \"〇\".equals(str)) return 0;\n" +
        "        long total = 0, section = 0, number = 0;\n" +
        "        for (int i = 0; i < str.length(); i++) {\n" +
        "            char ch = str.charAt(i);\n" +
        "            if (ch == '零' || ch == '〇') continue;\n" +
        "            if (CN_DIGIT_MAP.containsKey(ch)) number = CN_DIGIT_MAP.get(ch);\n" +
        "            else if (CN_UNIT_MAP.containsKey(ch)) {\n" +
        "                long unit = CN_UNIT_MAP.get(ch);\n" +
        "                boolean isSection = false;\n" +
        "                for (long su : CN_SECTION_UNITS) if (su == unit) { isSection = true; break; }\n" +
        "                if (isSection) {\n" +
        "                    section = (section + number) * unit; total += section; section = 0; number = 0;\n" +
        "                } else { if (number == 0) number = 1; section += number * unit; number = 0; }\n" +
        "            } else return -1;\n" +
        "        }\n" +
        "        return total + section + number;\n" +
        "    }\n\n" +
        "    private static int parseSubAmountPart(String part) {\n" +
        "        if (part == null || part.isEmpty() || \"零\".equals(part) || \"〇\".equals(part)) return 0;\n" +
        "        long n = parseChineseInteger(part);\n" +
        "        return (n < 0 || n > 9) ? -1 : (int) n;\n" +
        "    }\n\n" +
        "    private static String formatArabicAmount(BigDecimal num) {\n" +
        "        boolean negative = num.signum() < 0;\n" +
        "        num = num.abs().setScale(2, RoundingMode.HALF_UP);\n" +
        "        int cents = num.multiply(BigDecimal.valueOf(100)).intValue();\n" +
        "        int intPart = cents / 100, jiao = (cents % 100) / 10, fen = cents % 10;\n" +
        "        StringBuilder out = new StringBuilder(String.valueOf(intPart));\n" +
        "        if (jiao > 0 || fen > 0) {\n" +
        "            out.append('.');\n" +
        "            if (fen > 0) out.append(jiao).append(fen); else out.append(jiao);\n" +
        "        }\n" +
        "        return negative ? \"-\" + out : out.toString();\n" +
        "    }\n\n" +
        "    private static String convertSection(int section) {\n" +
        "        StringBuilder str = new StringBuilder();\n" +
        "        boolean zero = true;\n" +
        "        for (int unitPos = 0; section > 0; unitPos++, section /= 10) {\n" +
        "            int v = section % 10;\n" +
        "            if (v == 0) { if (!zero && unitPos > 0) str.insert(0, CN_NUM[0]); zero = true; }\n" +
        "            else { str.insert(0, CN_NUM[v] + CN_UNIT[unitPos]); zero = false; }\n" +
        "        }\n" +
        "        return str.toString();\n" +
        "    }\n\n" +
        "    private static String convertInteger(long n) {\n" +
        "        if (n == 0) return \"\";\n" +
        "        StringBuilder str = new StringBuilder();\n" +
        "        int secIndex = 0; boolean needZero = false;\n" +
        "        while (n > 0) {\n" +
        "            int section = (int) (n % 10000);\n" +
        "            if (needZero && section > 0 && section < 1000) str.insert(0, CN_NUM[0]);\n" +
        "            if (section > 0) {\n" +
        "                str.insert(0, convertSection(section) + CN_SEC[secIndex]);\n" +
        "                needZero = section < 1000;\n" +
        "            } else if (str.length() > 0) needZero = true;\n" +
        "            n /= 10000; secIndex++;\n" +
        "        }\n" +
        "        return str.toString();\n" +
        "    }\n\n" +
        "    private static String polish(String s) {\n" +
        "        return s.replaceAll(\"零+\", \"零\").replaceAll(\"零([万亿兆])\", \"$1\")\n" +
        "                .replaceAll(\"([壹贰叁肆伍陆柒捌玖拾佰仟万亿兆]+)零元\", \"$1元\")\n" +
        "                .replaceAll(\"零角\", \"\").replaceAll(\"零分$\", \"\")\n" +
        "                .replaceAll(\"亿万\", \"亿\");\n" +
        "    }\n" +
        "}\n\n" +
        "// RmbUppercaseUtils.toUppercase(\"1234.56\");\n" +
        "// RmbUppercaseUtils.toArabic(\"壹仟贰佰叁拾肆元伍角陆分\");";

    var PYTHON =
        "from decimal import Decimal, ROUND_HALF_UP\n\n\n" +
        "class RmbUppercaseUtils:\n" +
        "    CN_NUM = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']\n" +
        "    CN_UNIT = ['', '拾', '佰', '仟']\n" +
        "    CN_SEC = ['', '万', '亿', '兆']\n" +
        "    CN_DIGIT_MAP = {'零': 0, '〇': 0, '壹': 1, '一': 1, '贰': 2, '二': 2, '两': 2,\n" +
        "                    '叁': 3, '三': 3, '肆': 4, '四': 4, '伍': 5, '五': 5,\n" +
        "                    '陆': 6, '六': 6, '柒': 7, '七': 7, '捌': 8, '八': 8, '玖': 9, '九': 9}\n" +
        "    CN_UNIT_MAP = {'拾': 10, '十': 10, '佰': 100, '百': 100, '仟': 1000, '千': 1000,\n" +
        "                   '万': 10_000, '萬': 10_000, '亿': 10**8, '億': 10**8, '兆': 10**15}\n" +
        "    CN_SECTION_UNITS = {10_000, 10**8, 10**15}\n\n" +
        "    @classmethod\n" +
        "    def to_uppercase(cls, amount: str) -> str:\n" +
        "        \"\"\"1234.56 → 壹仟贰佰叁拾肆元伍角陆分\"\"\"\n" +
        "        s = (amount or '').strip().replace(',', '')\n" +
        "        if not s: raise ValueError('请输入金额')\n" +
        "        negative = False\n" +
        "        if s.startswith('-'): negative, s = True, s[1:]\n" +
        "        elif s.startswith('+'): s = s[1:]\n" +
        "        parts = s.split('.')\n" +
        "        if len(parts[0]) > 15: raise ValueError('整数部分不能超过 15 位')\n" +
        "        if len(parts) > 1 and len(parts[1]) > 2: raise ValueError('小数位最多 2 位')\n" +
        "        num = Decimal(s).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)\n" +
        "        if num == 0: return cls.CN_NUM[0] + '元整'\n" +
        "        num = abs(num)\n" +
        "        int_val = int(num)\n" +
        "        cents = int((num - int_val) * 100)\n" +
        "        jiao, fen = cents // 10, cents % 10\n" +
        "        result = (cls._convert_integer(int_val) + '元') if int_val > 0 else cls.CN_NUM[0] + '元'\n" +
        "        if jiao == 0 and fen == 0: result += '整'\n" +
        "        else:\n" +
        "            if jiao > 0: result += cls.CN_NUM[jiao] + '角'\n" +
        "            if fen > 0:\n" +
        "                if jiao == 0 and int_val > 0: result += cls.CN_NUM[0]\n" +
        "                result += cls.CN_NUM[fen] + '分'\n" +
        "        result = cls._polish(result)\n" +
        "        return ('负' + result) if negative else result\n\n" +
        "    @classmethod\n" +
        "    def to_arabic(cls, upper: str) -> str:\n" +
        "        \"\"\"壹仟贰佰叁拾肆元伍角陆分 → 1234.56\"\"\"\n" +
        "        s = cls._normalize_upper_input(upper)\n" +
        "        if not s: raise ValueError('请输入大写金额')\n" +
        "        negative = False\n" +
        "        if s[0] in ('负', '負'): negative, s = True, s[1:]\n" +
        "        if not s: raise ValueError('大写金额格式无效')\n" +
        "        if s.endswith('整'): s = s[:-1]\n" +
        "        yuan_idx = next((i for i, c in enumerate(s) if c in ('元', '圆')), -1)\n" +
        "        if yuan_idx >= 0: int_str, frac_str = s[:yuan_idx], s[yuan_idx + 1:]\n" +
        "        elif '角' in s or '分' in s: int_str, frac_str = '', s\n" +
        "        else: int_str, frac_str = s, ''\n" +
        "        int_val = 0\n" +
        "        if int_str and int_str not in ('零', '〇'):\n" +
        "            int_val = cls._parse_chinese_integer(int_str)\n" +
        "            if int_val is None: raise ValueError('大写金额格式无效')\n" +
        "        jiao = fen = 0\n" +
        "        if frac_str:\n" +
        "            jiao_idx, fen_idx = frac_str.find('角'), frac_str.find('分')\n" +
        "            if jiao_idx >= 0:\n" +
        "                jiao = cls._parse_sub_amount_part(frac_str[:jiao_idx])\n" +
        "                if jiao is None: raise ValueError('角位格式无效')\n" +
        "            if fen_idx >= 0:\n" +
        "                f_start = jiao_idx + 1 if jiao_idx >= 0 else 0\n" +
        "                fen = cls._parse_sub_amount_part(frac_str[f_start:fen_idx])\n" +
        "                if fen is None: raise ValueError('分位格式无效')\n" +
        "            tail = frac_str[(fen_idx + 1 if fen_idx >= 0 else jiao_idx + 1 if jiao_idx >= 0 else 0):]\n" +
        "            if tail and tail not in ('零', '〇'): raise ValueError('大写金额格式无效')\n" +
        "        num = Decimal(int_val) + Decimal(jiao) / 10 + Decimal(fen) / 100\n" +
        "        if negative: num = -num\n" +
        "        num = num.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)\n" +
        "        if len(str(int(abs(num)))) > 15: raise ValueError('整数部分不能超过 15 位')\n" +
        "        return cls._format_arabic_amount(num)\n\n" +
        "    @classmethod\n" +
        "    def _normalize_upper_input(cls, raw: str) -> str:\n" +
        "        import re\n" +
        "        s = (raw or '').strip().replace(' ', '').replace(',', '')\n" +
        "        s = re.sub(r'[（）()]', '', s)\n" +
        "        return re.sub(r'^人民币', '', s)\n\n" +
        "    @classmethod\n" +
        "    def _parse_chinese_integer(cls, s: str):\n" +
        "        if not s or s in ('零', '〇'): return 0\n" +
        "        total = section = number = 0\n" +
        "        for ch in s:\n" +
        "            if ch in ('零', '〇'): continue\n" +
        "            if ch in cls.CN_DIGIT_MAP: number = cls.CN_DIGIT_MAP[ch]\n" +
        "            elif ch in cls.CN_UNIT_MAP:\n" +
        "                unit = cls.CN_UNIT_MAP[ch]\n" +
        "                if unit in cls.CN_SECTION_UNITS:\n" +
        "                    section = (section + number) * unit; total += section; section = number = 0\n" +
        "                else:\n" +
        "                    if number == 0: number = 1\n" +
        "                    section += number * unit; number = 0\n" +
        "            else: return None\n" +
        "        return total + section + number\n\n" +
        "    @classmethod\n" +
        "    def _parse_sub_amount_part(cls, part: str):\n" +
        "        if not part or part in ('零', '〇'): return 0\n" +
        "        n = cls._parse_chinese_integer(part)\n" +
        "        return None if n is None or n < 0 or n > 9 else n\n\n" +
        "    @classmethod\n" +
        "    def _format_arabic_amount(cls, num: Decimal) -> str:\n" +
        "        negative = num < 0\n" +
        "        num = abs(num)\n" +
        "        cents = int(num * 100)\n" +
        "        int_part, jiao, fen = cents // 100, (cents % 100) // 10, cents % 10\n" +
        "        out = str(int_part)\n" +
        "        if jiao > 0 or fen > 0:\n" +
        "            out += '.' + (str(jiao) + str(fen) if fen > 0 else str(jiao))\n" +
        "        return ('-' if negative else '') + out\n\n" +
        "    @classmethod\n" +
        "    def _convert_section(cls, section: int) -> str:\n" +
        "        s, zero, unit_pos = '', True, 0\n" +
        "        while section > 0:\n" +
        "            v = section % 10\n" +
        "            if v == 0:\n" +
        "                if not zero and unit_pos > 0: s = cls.CN_NUM[0] + s\n" +
        "                zero = True\n" +
        "            else:\n" +
        "                s = cls.CN_NUM[v] + cls.CN_UNIT[unit_pos] + s; zero = False\n" +
        "            unit_pos += 1; section //= 10\n" +
        "        return s\n\n" +
        "    @classmethod\n" +
        "    def _convert_integer(cls, n: int) -> str:\n" +
        "        if n == 0: return ''\n" +
        "        s, sec_index, need_zero = '', 0, False\n" +
        "        while n > 0:\n" +
        "            section = n % 10000\n" +
        "            if need_zero and 0 < section < 1000: s = cls.CN_NUM[0] + s\n" +
        "            if section > 0:\n" +
        "                s = cls._convert_section(section) + cls.CN_SEC[sec_index] + s\n" +
        "                need_zero = section < 1000\n" +
        "            elif s: need_zero = True\n" +
        "            n //= 10000; sec_index += 1\n" +
        "        return s\n\n" +
        "    @classmethod\n" +
        "    def _polish(cls, s: str) -> str:\n" +
        "        import re\n" +
        "        s = re.sub(r'零+', '零', s)\n" +
        "        s = re.sub(r'零([万亿兆])', r'\\1', s)\n" +
        "        s = re.sub(r'([壹贰叁肆伍陆柒捌玖拾佰仟万亿兆]+)零元', r'\\1元', s)\n" +
        "        return s.replace('零角', '').replace('零分', '').replace('亿万', '亿')\n\n\n" +
        "# RmbUppercaseUtils.to_uppercase('1234.56')\n" +
        "# RmbUppercaseUtils.to_arabic('壹仟贰佰叁拾肆元伍角陆分')";

    var CSHARP =
        "using System;\n" +
        "using System.Collections.Generic;\n" +
        "using System.Linq;\n" +
        "using System.Text;\n" +
        "using System.Text.RegularExpressions;\n\n" +
        "public static class RmbUppercaseUtils\n" +
        "{\n" +
        "    private static readonly string[] CnNum = { \"零\",\"壹\",\"贰\",\"叁\",\"肆\",\"伍\",\"陆\",\"柒\",\"捌\",\"玖\" };\n" +
        "    private static readonly string[] CnUnit = { \"\",\"拾\",\"佰\",\"仟\" };\n" +
        "    private static readonly string[] CnSec = { \"\",\"万\",\"亿\",\"兆\" };\n" +
        "    private static readonly Dictionary<char, int> CnDigitMap = new()\n" +
        "    {\n" +
        "        ['零'] = 0, ['〇'] = 0, ['壹'] = 1, ['一'] = 1, ['贰'] = 2, ['二'] = 2, ['两'] = 2,\n" +
        "        ['叁'] = 3, ['三'] = 3, ['肆'] = 4, ['四'] = 4, ['伍'] = 5, ['五'] = 5,\n" +
        "        ['陆'] = 6, ['六'] = 6, ['柒'] = 7, ['七'] = 7, ['捌'] = 8, ['八'] = 8, ['玖'] = 9, ['九'] = 9\n" +
        "    };\n" +
        "    private static readonly Dictionary<char, long> CnUnitMap = new()\n" +
        "    {\n" +
        "        ['拾'] = 10, ['十'] = 10, ['佰'] = 100, ['百'] = 100, ['仟'] = 1000, ['千'] = 1000,\n" +
        "        ['万'] = 10_000, ['萬'] = 10_000, ['亿'] = 100_000_000, ['億'] = 100_000_000, ['兆'] = 1_000_000_000_000_000\n" +
        "    };\n" +
        "    private static readonly long[] CnSectionUnits = { 10_000, 100_000_000, 1_000_000_000_000_000 };\n\n" +
        "    /// <summary>1234.56 → 壹仟贰佰叁拾肆元伍角陆分</summary>\n" +
        "    public static string ToUppercase(string amount)\n" +
        "    {\n" +
        "        var s = (amount ?? \"\").Trim().Replace(\",\", \"\");\n" +
        "        if (string.IsNullOrEmpty(s)) throw new ArgumentException(\"请输入金额\");\n" +
        "        var negative = false;\n" +
        "        if (s.StartsWith(\"-\")) { negative = true; s = s[1..]; }\n" +
        "        else if (s.StartsWith(\"+\")) s = s[1..];\n" +
        "        if (!decimal.TryParse(s, out var num)) throw new ArgumentException(\"格式无效\");\n" +
        "        var parts = s.Split('.');\n" +
        "        if (parts[0].Length > 15) throw new ArgumentException(\"整数部分不能超过 15 位\");\n" +
        "        if (parts.Length > 1 && parts[1].Length > 2) throw new ArgumentException(\"小数位最多 2 位\");\n" +
        "        num = Math.Round(num, 2, MidpointRounding.AwayFromZero);\n" +
        "        if (num == 0) return CnNum[0] + \"元整\";\n" +
        "        num = Math.Abs(num);\n" +
        "        var intVal = (long)num;\n" +
        "        var cents = (int)Math.Round((num - intVal) * 100);\n" +
        "        var jiao = cents / 10; var fen = cents % 10;\n" +
        "        var result = intVal > 0 ? ConvertInteger(intVal) + \"元\" : CnNum[0] + \"元\";\n" +
        "        if (jiao == 0 && fen == 0) result += \"整\";\n" +
        "        else\n" +
        "        {\n" +
        "            if (jiao > 0) result += CnNum[jiao] + \"角\";\n" +
        "            if (fen > 0) { if (jiao == 0 && intVal > 0) result += CnNum[0]; result += CnNum[fen] + \"分\"; }\n" +
        "        }\n" +
        "        result = Polish(result);\n" +
        "        return negative ? \"负\" + result : result;\n" +
        "    }\n\n" +
        "    /// <summary>壹仟贰佰叁拾肆元伍角陆分 → 1234.56</summary>\n" +
        "    public static string ToArabic(string upper)\n" +
        "    {\n" +
        "        var s = NormalizeUpperInput(upper);\n" +
        "        if (string.IsNullOrEmpty(s)) throw new ArgumentException(\"请输入大写金额\");\n" +
        "        var negative = false;\n" +
        "        if (s.StartsWith(\"负\") || s.StartsWith(\"負\")) { negative = true; s = s[1..]; }\n" +
        "        if (string.IsNullOrEmpty(s)) throw new ArgumentException(\"大写金额格式无效\");\n" +
        "        if (s.EndsWith(\"整\")) s = s[..^1];\n" +
        "        var yuanIdx = s.IndexOfAny(new[] { '元', '圆' });\n" +
        "        string intStr, fracStr;\n" +
        "        if (yuanIdx >= 0) { intStr = s[..yuanIdx]; fracStr = s[(yuanIdx + 1)..]; }\n" +
        "        else if (s.Contains('角') || s.Contains('分')) { intStr = \"\"; fracStr = s; }\n" +
        "        else { intStr = s; fracStr = \"\"; }\n" +
        "        long intVal = 0;\n" +
        "        if (!string.IsNullOrEmpty(intStr) && intStr is not (\"零\" or \"〇\"))\n" +
        "        {\n" +
        "            intVal = ParseChineseInteger(intStr);\n" +
        "            if (intVal < 0) throw new ArgumentException(\"大写金额格式无效\");\n" +
        "        }\n" +
        "        var jiao = 0; var fen = 0;\n" +
        "        if (!string.IsNullOrEmpty(fracStr))\n" +
        "        {\n" +
        "            var jiaoIdx = fracStr.IndexOf('角'); var fenIdx = fracStr.IndexOf('分');\n" +
        "            if (jiaoIdx >= 0)\n" +
        "            {\n" +
        "                jiao = ParseSubAmountPart(fracStr[..jiaoIdx]);\n" +
        "                if (jiao < 0) throw new ArgumentException(\"角位格式无效\");\n" +
        "            }\n" +
        "            if (fenIdx >= 0)\n" +
        "            {\n" +
        "                var fStart = jiaoIdx >= 0 ? jiaoIdx + 1 : 0;\n" +
        "                fen = ParseSubAmountPart(fracStr[fStart..fenIdx]);\n" +
        "                if (fen < 0) throw new ArgumentException(\"分位格式无效\");\n" +
        "            }\n" +
        "            var tailStart = fenIdx >= 0 ? fenIdx + 1 : jiaoIdx >= 0 ? jiaoIdx + 1 : 0;\n" +
        "            var tail = fracStr[tailStart..];\n" +
        "            if (!string.IsNullOrEmpty(tail) && tail is not (\"零\" or \"〇\"))\n" +
        "                throw new ArgumentException(\"大写金额格式无效\");\n" +
        "        }\n" +
        "        var num = intVal + jiao * 0.1m + fen * 0.01m;\n" +
        "        if (negative) num = -num;\n" +
        "        num = Math.Round(num, 2, MidpointRounding.AwayFromZero);\n" +
        "        if (Math.Abs(num).ToString(\"0\").Length > 15) throw new ArgumentException(\"整数部分不能超过 15 位\");\n" +
        "        return FormatArabicAmount(num);\n" +
        "    }\n\n" +
        "    private static string NormalizeUpperInput(string raw) =>\n" +
        "        Regex.Replace((raw ?? \"\").Trim().Replace(\",\", \"\").Replace(\" \", \"\"), \"[（）()]\", \"\")\n" +
        "            .Replace(\"人民币\", \"\");\n\n" +
        "    private static long ParseChineseInteger(string str)\n" +
        "    {\n" +
        "        if (string.IsNullOrEmpty(str) || str is \"零\" or \"〇\") return 0;\n" +
        "        long total = 0, section = 0, number = 0;\n" +
        "        foreach (var ch in str)\n" +
        "        {\n" +
        "            if (ch is '零' or '〇') continue;\n" +
        "            if (CnDigitMap.TryGetValue(ch, out var d)) number = d;\n" +
        "            else if (CnUnitMap.TryGetValue(ch, out var unit))\n" +
        "            {\n" +
        "                if (CnSectionUnits.Contains(unit))\n" +
        "                { section = (section + number) * unit; total += section; section = 0; number = 0; }\n" +
        "                else { if (number == 0) number = 1; section += number * unit; number = 0; }\n" +
        "            }\n" +
        "            else return -1;\n" +
        "        }\n" +
        "        return total + section + number;\n" +
        "    }\n\n" +
        "    private static int ParseSubAmountPart(string part)\n" +
        "    {\n" +
        "        if (string.IsNullOrEmpty(part) || part is \"零\" or \"〇\") return 0;\n" +
        "        var n = ParseChineseInteger(part);\n" +
        "        return n < 0 || n > 9 ? -1 : (int)n;\n" +
        "    }\n\n" +
        "    private static string FormatArabicAmount(decimal num)\n" +
        "    {\n" +
        "        var negative = num < 0; num = Math.Abs(num);\n" +
        "        var cents = (int)Math.Round(num * 100);\n" +
        "        var intPart = cents / 100; var jiao = (cents % 100) / 10; var fen = cents % 10;\n" +
        "        var outStr = intPart.ToString();\n" +
        "        if (jiao > 0 || fen > 0) outStr += \".\" + (fen > 0 ? $\"{jiao}{fen}\" : jiao.ToString());\n" +
        "        return negative ? \"-\" + outStr : outStr;\n" +
        "    }\n\n" +
        "    private static string ConvertSection(int section)\n" +
        "    {\n" +
        "        var sb = new StringBuilder(); var zero = true;\n" +
        "        for (var unitPos = 0; section > 0; unitPos++, section /= 10)\n" +
        "        {\n" +
        "            var v = section % 10;\n" +
        "            if (v == 0) { if (!zero && unitPos > 0) sb.Insert(0, CnNum[0]); zero = true; }\n" +
        "            else { sb.Insert(0, CnNum[v] + CnUnit[unitPos]); zero = false; }\n" +
        "        }\n" +
        "        return sb.ToString();\n" +
        "    }\n\n" +
        "    private static string ConvertInteger(long n)\n" +
        "    {\n" +
        "        if (n == 0) return \"\";\n" +
        "        var sb = new StringBuilder(); var secIndex = 0; var needZero = false;\n" +
        "        while (n > 0)\n" +
        "        {\n" +
        "            var section = (int)(n % 10000);\n" +
        "            if (needZero && section > 0 && section < 1000) sb.Insert(0, CnNum[0]);\n" +
        "            if (section > 0) { sb.Insert(0, ConvertSection(section) + CnSec[secIndex]); needZero = section < 1000; }\n" +
        "            else if (sb.Length > 0) needZero = true;\n" +
        "            n /= 10000; secIndex++;\n" +
        "        }\n" +
        "        return sb.ToString();\n" +
        "    }\n\n" +
        "    private static string Polish(string s) =>\n" +
        "        Regex.Replace(Regex.Replace(s, \"零+\", \"零\"), \"零([万亿兆])\", \"$1\")\n" +
        "            .Replace(\"零角\", \"\").Replace(\"零分\", \"\").Replace(\"亿万\", \"亿\");\n" +
        "}\n\n" +
        "// RmbUppercaseUtils.ToUppercase(\"1234.56\");\n" +
        "// RmbUppercaseUtils.ToArabic(\"壹仟贰佰叁拾肆元伍角陆分\");";

    var GO =
        "package rmb\n\n" +
        "import (\n" +
        "    \"fmt\"\n" +
        "    \"math\"\n" +
        "    \"regexp\"\n" +
        "    \"strconv\"\n" +
        "    \"strings\"\n" +
        ")\n\n" +
        "var (\n" +
        "    cnNum  = []string{\"零\", \"壹\", \"贰\", \"叁\", \"肆\", \"伍\", \"陆\", \"柒\", \"捌\", \"玖\"}\n" +
        "    cnUnit = []string{\"\", \"拾\", \"佰\", \"仟\"}\n" +
        "    cnSec  = []string{\"\", \"万\", \"亿\", \"兆\"}\n" +
        "    cnDigitMap = map[rune]int{'零':0,'〇':0,'壹':1,'一':1,'贰':2,'二':2,'两':2,'叁':3,'三':3,\n" +
        "        '肆':4,'四':4,'伍':5,'五':5,'陆':6,'六':6,'柒':7,'七':7,'捌':8,'八':8,'玖':9,'九':9}\n" +
        "    cnUnitMap = map[rune]int64{'拾':10,'十':10,'佰':100,'百':100,'仟':1000,'千':1000,\n" +
        "        '万':1e4,'萬':1e4,'亿':1e8,'億':1e8,'兆':1e15}\n" +
        "    cnSectionUnits = []int64{1e4, 1e8, 1e15}\n" +
        ")\n\n" +
        "// ToUppercase 1234.56 → 壹仟贰佰叁拾肆元伍角陆分\n" +
        "func ToUppercase(amount string) (string, error) {\n" +
        "    s := strings.TrimSpace(strings.ReplaceAll(amount, \",\", \"\"))\n" +
        "    if s == \"\" { return \"\", fmt.Errorf(\"请输入金额\") }\n" +
        "    negative := false\n" +
        "    if strings.HasPrefix(s, \"-\") { negative, s = true, s[1:] }\n" +
        "    else if strings.HasPrefix(s, \"+\") { s = s[1:] }\n" +
        "    num, err := strconv.ParseFloat(s, 64)\n" +
        "    if err != nil { return \"\", fmt.Errorf(\"格式无效\") }\n" +
        "    parts := strings.SplitN(s, \".\", 2)\n" +
        "    if len(parts[0]) > 15 { return \"\", fmt.Errorf(\"整数部分不能超过 15 位\") }\n" +
        "    if len(parts) == 2 && len(parts[1]) > 2 { return \"\", fmt.Errorf(\"小数位最多 2 位\") }\n" +
        "    num = math.Round(num*100) / 100\n" +
        "    if num == 0 { return cnNum[0] + \"元整\", nil }\n" +
        "    abs := math.Abs(num)\n" +
        "    intVal := int64(abs)\n" +
        "    cents := int(math.Round((abs - float64(intVal)) * 100))\n" +
        "    jiao, fen := cents/10, cents%10\n" +
        "    result := cnNum[0] + \"元\"\n" +
        "    if intVal > 0 { result = convertInteger(intVal) + \"元\" }\n" +
        "    if jiao == 0 && fen == 0 { result += \"整\" } else {\n" +
        "        if jiao > 0 { result += cnNum[jiao] + \"角\" }\n" +
        "        if fen > 0 {\n" +
        "            if jiao == 0 && intVal > 0 { result += cnNum[0] }\n" +
        "            result += cnNum[fen] + \"分\"\n" +
        "        }\n" +
        "    }\n" +
        "    result = polish(result)\n" +
        "    if negative { result = \"负\" + result }\n" +
        "    return result, nil\n" +
        "}\n\n" +
        "// ToArabic 壹仟贰佰叁拾肆元伍角陆分 → 1234.56\n" +
        "func ToArabic(upper string) (string, error) {\n" +
        "    s := normalizeUpperInput(upper)\n" +
        "    if s == \"\" { return \"\", fmt.Errorf(\"请输入大写金额\") }\n" +
        "    negative := false\n" +
        "    if strings.HasPrefix(s, \"负\") || strings.HasPrefix(s, \"負\") {\n" +
        "        negative, s = true, string([]rune(s)[1:])\n" +
        "    }\n" +
        "    if s == \"\" { return \"\", fmt.Errorf(\"大写金额格式无效\") }\n" +
        "    if strings.HasSuffix(s, \"整\") { s = s[:len(s)-len(\"整\")] }\n" +
        "    yuanIdx := strings.IndexAny(s, \"元圆\")\n" +
        "    var intStr, fracStr string\n" +
        "    switch {\n" +
        "    case yuanIdx >= 0:\n" +
        "        intStr, fracStr = s[:yuanIdx], s[yuanIdx+len(\"元\"):]\n" +
        "        if yuanIdx < len(s) && s[yuanIdx] == '圆' { fracStr = s[yuanIdx+len(\"圆\"):] }\n" +
        "    case strings.ContainsAny(s, \"角分\"):\n" +
        "        fracStr = s\n" +
        "    default:\n" +
        "        intStr = s\n" +
        "    }\n" +
        "    intVal := int64(0)\n" +
        "    if intStr != \"\" && intStr != \"零\" && intStr != \"〇\" {\n" +
        "        v, ok := parseChineseInteger(intStr)\n" +
        "        if !ok { return \"\", fmt.Errorf(\"大写金额格式无效\") }\n" +
        "        intVal = v\n" +
        "    }\n" +
        "    jiao, fen := 0, 0\n" +
        "    if fracStr != \"\" {\n" +
        "        jiaoIdx := strings.Index(fracStr, \"角\")\n" +
        "        fenIdx := strings.Index(fracStr, \"分\")\n" +
        "        if jiaoIdx >= 0 {\n" +
        "            v, ok := parseSubAmountPart(fracStr[:jiaoIdx])\n" +
        "            if !ok { return \"\", fmt.Errorf(\"角位格式无效\") }\n" +
        "            jiao = v\n" +
        "        }\n" +
        "        if fenIdx >= 0 {\n" +
        "            fStart := 0\n" +
        "            if jiaoIdx >= 0 { fStart = jiaoIdx + len(\"角\") }\n" +
        "            v, ok := parseSubAmountPart(fracStr[fStart:fenIdx])\n" +
        "            if !ok { return \"\", fmt.Errorf(\"分位格式无效\") }\n" +
        "            fen = v\n" +
        "        }\n" +
        "    }\n" +
        "    num := float64(intVal) + float64(jiao)*0.1 + float64(fen)*0.01\n" +
        "    if negative { num = -num }\n" +
        "    num = math.Round(num*100) / 100\n" +
        "    return formatArabicAmount(num), nil\n" +
        "}\n\n" +
        "func normalizeUpperInput(raw string) string {\n" +
        "    s := strings.TrimSpace(strings.ReplaceAll(raw, \",\", \"\"))\n" +
        "    s = strings.ReplaceAll(s, \" \", \"\")\n" +
        "    re := regexp.MustCompile(`[（）()]`)\n" +
        "    s = re.ReplaceAllString(s, \"\")\n" +
        "    return strings.TrimPrefix(s, \"人民币\")\n" +
        "}\n\n" +
        "func parseChineseInteger(str string) (int64, bool) {\n" +
        "    if str == \"\" || str == \"零\" || str == \"〇\" { return 0, true }\n" +
        "    var total, section, number int64\n" +
        "    for _, ch := range str {\n" +
        "        if ch == '零' || ch == '〇' { continue }\n" +
        "        if d, ok := cnDigitMap[ch]; ok { number = int64(d) } else if unit, ok := cnUnitMap[ch]; ok {\n" +
        "            isSection := false\n" +
        "            for _, su := range cnSectionUnits { if su == unit { isSection = true; break } }\n" +
        "            if isSection {\n" +
        "                section = (section + number) * unit; total += section; section, number = 0, 0\n" +
        "            } else {\n" +
        "                if number == 0 { number = 1 }\n" +
        "                section += number * unit; number = 0\n" +
        "            }\n" +
        "        } else { return 0, false }\n" +
        "    }\n" +
        "    return total + section + number, true\n" +
        "}\n\n" +
        "func parseSubAmountPart(part string) (int, bool) {\n" +
        "    if part == \"\" || part == \"零\" || part == \"〇\" { return 0, true }\n" +
        "    n, ok := parseChineseInteger(part)\n" +
        "    if !ok || n < 0 || n > 9 { return 0, false }\n" +
        "    return int(n), true\n" +
        "}\n\n" +
        "func formatArabicAmount(num float64) string {\n" +
        "    negative := num < 0\n" +
        "    cents := int(math.Round(math.Abs(num) * 100))\n" +
        "    intPart, jiao, fen := cents/100, (cents%100)/10, cents%10\n" +
        "    out := strconv.Itoa(intPart)\n" +
        "    if jiao > 0 || fen > 0 {\n" +
        "        out += \".\"\n" +
        "        if fen > 0 { out += strconv.Itoa(jiao) + strconv.Itoa(fen) } else { out += strconv.Itoa(jiao) }\n" +
        "    }\n" +
        "    if negative { return \"-\" + out }\n" +
        "    return out\n" +
        "}\n\n" +
        "func convertSection(section int) string {\n" +
        "    var b strings.Builder\n" +
        "    zero, unitPos := true, 0\n" +
        "    for section > 0 {\n" +
        "        v := section % 10\n" +
        "        if v == 0 {\n" +
        "            if !zero && unitPos > 0 { b.WriteString(cnNum[0]) }\n" +
        "            zero = true\n" +
        "        } else {\n" +
        "            b.WriteString(cnNum[v] + cnUnit[unitPos])\n" +
        "            zero = false\n" +
        "        }\n" +
        "        unitPos++; section /= 10\n" +
        "    }\n" +
        "    runes := []rune(b.String())\n" +
        "    for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 { runes[i], runes[j] = runes[j], runes[i] }\n" +
        "    return string(runes)\n" +
        "}\n\n" +
        "func convertInteger(n int64) string {\n" +
        "    if n == 0 { return \"\" }\n" +
        "    var parts []string\n" +
        "    secIndex, needZero := 0, false\n" +
        "    for n > 0 {\n" +
        "        section := int(n % 10000)\n" +
        "        if needZero && section > 0 && section < 1000 { parts = append([]string{cnNum[0]}, parts...) }\n" +
        "        if section > 0 {\n" +
        "            parts = append([]string{convertSection(section) + cnSec[secIndex]}, parts...)\n" +
        "            needZero = section < 1000\n" +
        "        } else if len(parts) > 0 { needZero = true }\n" +
        "        n /= 10000; secIndex++\n" +
        "    }\n" +
        "    return strings.Join(parts, \"\")\n" +
        "}\n\n" +
        "func polish(s string) string {\n" +
        "    re := regexp.MustCompile(`零+`)\n" +
        "    s = re.ReplaceAllString(s, \"零\")\n" +
        "    s = strings.ReplaceAll(s, \"零角\", \"\")\n" +
        "    s = strings.ReplaceAll(s, \"零分\", \"\")\n" +
        "    return strings.ReplaceAll(s, \"亿万\", \"亿\")\n" +
        "}";

    var PHP =
        "<?php\n\n" +
        "final class RmbUppercaseUtils\n" +
        "{\n" +
        "    private const CN_NUM = ['零','壹','贰','叁','肆','伍','陆','柒','捌','玖'];\n" +
        "    private const CN_UNIT = ['','拾','佰','仟'];\n" +
        "    private const CN_SEC = ['','万','亿','兆'];\n" +
        "    private const CN_DIGIT_MAP = ['零'=>0,'〇'=>0,'壹'=>1,'一'=>1,'贰'=>2,'二'=>2,'两'=>2,\n" +
        "        '叁'=>3,'三'=>3,'肆'=>4,'四'=>4,'伍'=>5,'五'=>5,'陆'=>6,'六'=>6,\n" +
        "        '柒'=>7,'七'=>7,'捌'=>8,'八'=>8,'玖'=>9,'九'=>9];\n" +
        "    private const CN_UNIT_MAP = ['拾'=>10,'十'=>10,'佰'=>100,'百'=>100,'仟'=>1000,'千'=>1000,\n" +
        "        '万'=>10000,'萬'=>10000,'亿'=>100000000,'億'=>100000000,'兆'=>1000000000000000];\n" +
        "    private const CN_SECTION_UNITS = [10000, 100000000, 1000000000000000];\n\n" +
        "    /** 1234.56 → 壹仟贰佰叁拾肆元伍角陆分 */\n" +
        "    public static function toUppercase(string $amount): string\n" +
        "    {\n" +
        "        $s = str_replace(',', '', trim($amount));\n" +
        "        if ($s === '') throw new InvalidArgumentException('请输入金额');\n" +
        "        $negative = false;\n" +
        "        if (str_starts_with($s, '-')) { $negative = true; $s = substr($s, 1); }\n" +
        "        elseif (str_starts_with($s, '+')) $s = substr($s, 1);\n" +
        "        if (!preg_match('/^\\d+(\\.\\d+)?$/', $s)) throw new InvalidArgumentException('格式无效');\n" +
        "        $parts = explode('.', $s, 2);\n" +
        "        if (strlen($parts[0]) > 15) throw new InvalidArgumentException('整数部分不能超过 15 位');\n" +
        "        if (isset($parts[1]) && strlen($parts[1]) > 2) throw new InvalidArgumentException('小数位最多 2 位');\n" +
        "        $num = round((float)$s, 2);\n" +
        "        if ($num == 0.0) return self::CN_NUM[0] . '元整';\n" +
        "        $abs = abs($num);\n" +
        "        $intVal = (int)$abs;\n" +
        "        $cents = (int)round(($abs - $intVal) * 100);\n" +
        "        $jiao = intdiv($cents, 10); $fen = $cents % 10;\n" +
        "        $result = $intVal > 0 ? self::convertInteger($intVal) . '元' : self::CN_NUM[0] . '元';\n" +
        "        if ($jiao === 0 && $fen === 0) $result .= '整';\n" +
        "        else {\n" +
        "            if ($jiao > 0) $result .= self::CN_NUM[$jiao] . '角';\n" +
        "            if ($fen > 0) {\n" +
        "                if ($jiao === 0 && $intVal > 0) $result .= self::CN_NUM[0];\n" +
        "                $result .= self::CN_NUM[$fen] . '分';\n" +
        "            }\n" +
        "        }\n" +
        "        $result = self::polish($result);\n" +
        "        return $negative ? '负' . $result : $result;\n" +
        "    }\n\n" +
        "    /** 壹仟贰佰叁拾肆元伍角陆分 → 1234.56 */\n" +
        "    public static function toArabic(string $upper): string\n" +
        "    {\n" +
        "        $s = self::normalizeUpperInput($upper);\n" +
        "        if ($s === '') throw new InvalidArgumentException('请输入大写金额');\n" +
        "        $negative = false;\n" +
        "        if (str_starts_with($s, '负') || str_starts_with($s, '負')) { $negative = true; $s = mb_substr($s, 1); }\n" +
        "        if ($s === '') throw new InvalidArgumentException('大写金额格式无效');\n" +
        "        if (str_ends_with($s, '整')) $s = mb_substr($s, 0, -1);\n" +
        "        $yuanIdx = mb_strpos($s, '元');\n" +
        "        if ($yuanIdx === false) $yuanIdx = mb_strpos($s, '圆');\n" +
        "        if ($yuanIdx !== false) {\n" +
        "            $intStr = mb_substr($s, 0, $yuanIdx);\n" +
        "            $fracStr = mb_substr($s, $yuanIdx + 1);\n" +
        "        } elseif (preg_match('/角|分/u', $s)) { $intStr = ''; $fracStr = $s; }\n" +
        "        else { $intStr = $s; $fracStr = ''; }\n" +
        "        $intVal = 0;\n" +
        "        if ($intStr !== '' && !in_array($intStr, ['零', '〇'], true)) {\n" +
        "            $intVal = self::parseChineseInteger($intStr);\n" +
        "            if ($intVal < 0) throw new InvalidArgumentException('大写金额格式无效');\n" +
        "        }\n" +
        "        $jiao = $fen = 0;\n" +
        "        if ($fracStr !== '') {\n" +
        "            $jiaoIdx = mb_strpos($fracStr, '角');\n" +
        "            $fenIdx = mb_strpos($fracStr, '分');\n" +
        "            if ($jiaoIdx !== false) {\n" +
        "                $jiao = self::parseSubAmountPart(mb_substr($fracStr, 0, $jiaoIdx));\n" +
        "                if ($jiao < 0) throw new InvalidArgumentException('角位格式无效');\n" +
        "            }\n" +
        "            if ($fenIdx !== false) {\n" +
        "                $fStart = $jiaoIdx !== false ? $jiaoIdx + 1 : 0;\n" +
        "                $fen = self::parseSubAmountPart(mb_substr($fracStr, $fStart, $fenIdx - $fStart));\n" +
        "                if ($fen < 0) throw new InvalidArgumentException('分位格式无效');\n" +
        "            }\n" +
        "        }\n" +
        "        $num = $intVal + $jiao * 0.1 + $fen * 0.01;\n" +
        "        if ($negative) $num = -$num;\n" +
        "        $num = round($num, 2);\n" +
        "        return self::formatArabicAmount($num);\n" +
        "    }\n\n" +
        "    private static function normalizeUpperInput(string $raw): string\n" +
        "    {\n" +
        "        $s = preg_replace('/\\s+/u', '', trim(str_replace(',', '', $raw)));\n" +
        "        $s = preg_replace('/[（）()]/u', '', $s);\n" +
        "        return preg_replace('/^人民币/u', '', $s);\n" +
        "    }\n\n" +
        "    private static function parseChineseInteger(string $str): int\n" +
        "    {\n" +
        "        if ($str === '' || in_array($str, ['零', '〇'], true)) return 0;\n" +
        "        $total = $section = $number = 0;\n" +
        "        foreach (preg_split('//u', $str, -1, PREG_SPLIT_NO_EMPTY) as $ch) {\n" +
        "            if ($ch === '零' || $ch === '〇') continue;\n" +
        "            if (isset(self::CN_DIGIT_MAP[$ch])) $number = self::CN_DIGIT_MAP[$ch];\n" +
        "            elseif (isset(self::CN_UNIT_MAP[$ch])) {\n" +
        "                $unit = self::CN_UNIT_MAP[$ch];\n" +
        "                if (in_array($unit, self::CN_SECTION_UNITS, true)) {\n" +
        "                    $section = ($section + $number) * $unit; $total += $section; $section = $number = 0;\n" +
        "                } else {\n" +
        "                    if ($number === 0) $number = 1;\n" +
        "                    $section += $number * $unit; $number = 0;\n" +
        "                }\n" +
        "            } else return -1;\n" +
        "        }\n" +
        "        return $total + $section + $number;\n" +
        "    }\n\n" +
        "    private static function parseSubAmountPart(string $part): int\n" +
        "    {\n" +
        "        if ($part === '' || in_array($part, ['零', '〇'], true)) return 0;\n" +
        "        $n = self::parseChineseInteger($part);\n" +
        "        return ($n < 0 || $n > 9) ? -1 : $n;\n" +
        "    }\n\n" +
        "    private static function formatArabicAmount(float $num): string\n" +
        "    {\n" +
        "        $negative = $num < 0;\n" +
        "        $cents = (int)round(abs($num) * 100);\n" +
        "        $intPart = intdiv($cents, 100); $jiao = intdiv($cents % 100, 10); $fen = $cents % 10;\n" +
        "        $out = (string)$intPart;\n" +
        "        if ($jiao > 0 || $fen > 0) $out .= '.' . ($fen > 0 ? $jiao . $fen : (string)$jiao);\n" +
        "        return ($negative ? '-' : '') . $out;\n" +
        "    }\n\n" +
        "    private static function convertSection(int $section): string\n" +
        "    {\n" +
        "        $str = ''; $zero = true; $unitPos = 0;\n" +
        "        while ($section > 0) {\n" +
        "            $v = $section % 10;\n" +
        "            if ($v === 0) { if (!$zero && $unitPos > 0) $str = self::CN_NUM[0] . $str; $zero = true; }\n" +
        "            else { $str = self::CN_NUM[$v] . self::CN_UNIT[$unitPos] . $str; $zero = false; }\n" +
        "            $unitPos++; $section = intdiv($section, 10);\n" +
        "        }\n" +
        "        return $str;\n" +
        "    }\n\n" +
        "    private static function convertInteger(int $n): string\n" +
        "    {\n" +
        "        if ($n === 0) return '';\n" +
        "        $str = ''; $secIndex = 0; $needZero = false;\n" +
        "        while ($n > 0) {\n" +
        "            $section = $n % 10000;\n" +
        "            if ($needZero && $section > 0 && $section < 1000) $str = self::CN_NUM[0] . $str;\n" +
        "            if ($section > 0) {\n" +
        "                $str = self::convertSection($section) . self::CN_SEC[$secIndex] . $str;\n" +
        "                $needZero = $section < 1000;\n" +
        "            } elseif ($str !== '') $needZero = true;\n" +
        "            $n = intdiv($n, 10000); $secIndex++;\n" +
        "        }\n" +
        "        return $str;\n" +
        "    }\n\n" +
        "    private static function polish(string $s): string\n" +
        "    {\n" +
        "        $s = preg_replace('/零+/', '零', $s);\n" +
        "        $s = preg_replace('/零([万亿兆])/', '$1', $s);\n" +
        "        return str_replace(['零角', '零分', '亿万'], ['', '', '亿'], $s);\n" +
        "    }\n" +
        "}\n\n" +
        "// echo RmbUppercaseUtils::toUppercase('1234.56');\n" +
        "// echo RmbUppercaseUtils::toArabic('壹仟贰佰叁拾肆元伍角陆分');";

    global.RmbCodeSamples = {
        javascript: JS,
        java: JAVA,
        python: PYTHON,
        csharp: CSHARP,
        go: GO,
        php: PHP,
    };
})(typeof window !== "undefined" ? window : this);
