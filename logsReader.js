const designationSets = [
    ['HCapA', 'CAP', 'HCapB'],
    ['1x2A', '1x2D', '1x2B'],
    ['GM', 'G', 'GL'],
    ['CM', 'C', 'CL']
];

function getBookmaker(line) {
    if (line.includes('OnTe_ZeTu_ZeEt_ZeTu_')) return 'bet365';
    if (line.includes('OnTe_ZeTu_ZeEt_e')) return '1xbet';
    if (line.includes('OnTe_ZeTu_ZeEt_ZeRe_')) return 'CBet';
    if (line.includes('OnTe_ZeTu_ZeEt_OnFi_')) return 'BMaker';
    return null;
}

function classifyLine(line) {
    // Строки разделители - очень короткие строки или строки без цифр и основных паттернов
    if (line.length < 3) return 'separator';
    
    // Основные индикаторы
    if (getBookmaker(line)) return 'main_indicator';
    
    // Дополнительные индикаторы
    if (line.startsWith('ZeOn_0OnTu_') && line.split('_').length <= 3) return 'additional_indicator';
    
    // Строки данных - содержат цифры и имеют паттерн "буквы_число"
    if (line.includes('_') && /\d/.test(line)) return 'data';
    
    // Остальное - разделители
    return 'separator';
}

function isBlockSeparator(lines, index, currentBlock) {
    const line = lines[index];
    const type = classifyLine(line);
    
    // Если это не разделитель, то точно не разделяет блоки
    if (type !== 'separator') return false;
    
    // Проверяем последовательность разделителей
    let separatorCount = 0;
    for (let i = index; i < lines.length && classifyLine(lines[i]) === 'separator'; i++) {
        separatorCount++;
    }
    
    // Если 2 или более разделителей подряд - это точно разделитель блоков
    if (separatorCount >= 2) return true;
    
    // Проверяем, не является ли это четвертой строкой данных после 3-х строк данных
    let dataCount = 0;
    for (const { type: blockType } of currentBlock) {
        if (blockType === 'data') dataCount++;
    }
    
    // Если уже есть 3 строки данных и текущая строка - разделитель, это разделитель блоков
    if (dataCount === 3) return true;
    
    return false;
}

function detectScenarioType(block) {
    let dataCount = 0;
    let hasMainIndicator = false;
    let hasAdditionalIndicator = false;
    let mainIndicatorIndex = -1;
    let additionalIndicatorIndex = -1;
    let dataIndices = [];

    for (let i = 0; i < block.length; i++) {
        const { type } = block[i];
        if (type === 'data') {
            dataCount++;
            dataIndices.push(i);
        } else if (type === 'main_indicator') {
            hasMainIndicator = true;
            mainIndicatorIndex = i;
        } else if (type === 'additional_indicator') {
            hasAdditionalIndicator = true;
            additionalIndicatorIndex = i;
        }
    }

    // Сценарий A: 9 строк данных, дополнительный индикатор после 3-х строк, основной после 6-и
    if (dataCount === 9 && hasMainIndicator && hasAdditionalIndicator) {
        // Проверяем порядок: 3 data, additional, 3 data, main, 3 data
        if (dataIndices[2] < additionalIndicatorIndex && 
            additionalIndicatorIndex < dataIndices[5] && 
            dataIndices[5] < mainIndicatorIndex && 
            mainIndicatorIndex < dataIndices[8]) {
            return 'A';
        }
    }
    
    // Сценарий B: 6 строк данных, основной индикатор после 3-х строк
    if (dataCount === 6 && hasMainIndicator && !hasAdditionalIndicator) {
        if (dataIndices[2] < mainIndicatorIndex && mainIndicatorIndex < dataIndices[5]) {
            return 'B';
        }
    }
    
    // Сценарий C: 3 строки данных, основной индикатор, затем дополнительный
    if (dataCount === 3 && hasMainIndicator && hasAdditionalIndicator) {
        if (dataIndices[2] < mainIndicatorIndex && mainIndicatorIndex < additionalIndicatorIndex) {
            return 'C';
        }
    }
    
    // Сценарий D: 3 строки данных, дополнительный индикатор в начале, основной в конце
    if (dataCount === 3 && hasMainIndicator && hasAdditionalIndicator) {
        if (additionalIndicatorIndex < dataIndices[0] && dataIndices[2] < mainIndicatorIndex) {
            return 'D';
        }
    }
    
    // Специальный случай: только строки данных без индикаторов (матчи 9, 10)
    if (dataCount === 3 && !hasMainIndicator && !hasAdditionalIndicator) {
        return 'data_only';
    }

    return 'unknown';
}

function processScenarioA(block, bookmaker, designationSet) {
    const comments = [];
    let dataIndex = 0;
    
    for (const { line, type } of block) {
        if (type === 'data') {
            let comment;
            if (dataIndex < 3) {
                comment = `old_${designationSet[dataIndex % 3]}_${bookmaker}`;
            } else if (dataIndex < 6) {
                comment = `live_${designationSet[dataIndex % 3]}_${bookmaker}`;
            } else if (dataIndex < 9) {
                comment = `new_${designationSet[dataIndex % 3]}_${bookmaker}`;
            }
            comments.push(`${line} # ${comment}`);
            dataIndex++;
        } else if (type === 'main_indicator') {
            comments.push(`${line} # Основной индикатор (${bookmaker})`);
        } else if (type === 'additional_indicator') {
            comments.push(`${line} # Дополнительный индикатор`);
        }
    }
    
    return comments;
}

function processScenarioB(block, bookmaker, designationSet) {
    const comments = [];
    let dataIndex = 0;
    
    for (const { line, type } of block) {
        if (type === 'data') {
            let comment;
            if (dataIndex < 3) {
                comment = `old_${designationSet[dataIndex % 3]}_${bookmaker}`;
            } else if (dataIndex < 6) {
                comment = `new_${designationSet[dataIndex % 3]}_${bookmaker}`;
            }
            comments.push(`${line} # ${comment}`);
            dataIndex++;
        } else if (type === 'main_indicator') {
            comments.push(`${line} # Основной индикатор (${bookmaker})`);
        }
    }
    
    return comments;
}

function processScenarioC(block, bookmaker, designationSet) {
    const comments = [];
    let dataIndex = 0;
    
    for (const { line, type } of block) {
        if (type === 'data') {
            const comment = `old_${designationSet[dataIndex % 3]}_${bookmaker}`;
            comments.push(`${line} # ${comment}`);
            dataIndex++;
        } else if (type === 'main_indicator') {
            comments.push(`${line} # Основной индикатор (${bookmaker})`);
        } else if (type === 'additional_indicator') {
            comments.push(`${line} # Дополнительный индикатор`);
        }
    }
    
    return comments;
}

function processScenarioD(block, bookmaker, designationSet) {
    const comments = [];
    let dataIndex = 0;
    
    for (const { line, type } of block) {
        if (type === 'additional_indicator') {
            comments.push(`${line} # Дополнительный индикатор`);
        } else if (type === 'data') {
            const comment = `live_${designationSet[dataIndex % 3]}_${bookmaker}`;
            comments.push(`${line} # ${comment}`);
            dataIndex++;
        } else if (type === 'main_indicator') {
            comments.push(`${line} # Основной индикатор (${bookmaker})`);
        }
    }
    
    return comments;
}

function processDataOnlyBlock(block, globalContext) {
    const comments = [];
    let dataIndex = 0;
    
    // Пытаемся определить букмекера по контексту или по паттернам в строках
    let bookmaker = globalContext.lastBookmaker || '1xbet'; // По умолчанию 1xbet для матчей 9,10
    let designationSet = ['HCapA', 'CAP', 'HCapB']; // По умолчанию первый набор
    
    // Определяем набор обозначений на основе глобального контекста
    if (globalContext.counts && globalContext.counts[bookmaker] !== undefined) {
        designationSet = designationSets[globalContext.counts[bookmaker] % designationSets.length];
    }
    
    for (const { line, type } of block) {
        if (type === 'data') {
            const comment = `live_${designationSet[dataIndex % 3]}_${bookmaker}`;
            comments.push(`${line} # ${comment}`);
            dataIndex++;
        }
    }
    
    return comments;
}

function processScenarioBlock(block, counts, globalContext) {
    // Определяем букмекера
    let bookmaker = null;
    for (const { line, type } of block) {
        if (type === 'main_indicator') {
            bookmaker = getBookmaker(line);
            break;
        }
    }
    
    // Определяем тип сценария
    const scenarioType = detectScenarioType(block);
    
    // Обрабатываем блоки только с данными (без индикаторов)
    if (scenarioType === 'data_only') {
        const comments = processDataOnlyBlock(block, globalContext);
        comments.forEach(comment => console.log(comment));
        return;
    }
    
    if (!bookmaker || scenarioType === 'unknown') {
        // Выводим отладочную информацию только если блок содержит данные
        const hasData = block.some(({ type }) => type === 'data');
        if (hasData) {
            console.log(`Не удалось определить тип блока. Букмекер: ${bookmaker}, сценарий: ${scenarioType}`);
            console.log('Содержимое блока:', block.map(item => `${item.type}: ${item.line}`).join(', '));
        }
        return;
    }

    console.log(`Определен сценарий ${scenarioType} для букмекера ${bookmaker}`);

    // Получаем набор обозначений на основе счетчика появлений букмекера
    const count = counts[bookmaker];
    const designationSet = designationSets[count % designationSets.length];
    
    // Обрабатываем блок в зависимости от типа сценария
    let comments;
    switch (scenarioType) {
        case 'A':
            comments = processScenarioA(block, bookmaker, designationSet);
            break;
        case 'B':
            comments = processScenarioB(block, bookmaker, designationSet);
            break;
        case 'C':
            comments = processScenarioC(block, bookmaker, designationSet);
            break;
        case 'D':
            comments = processScenarioD(block, bookmaker, designationSet);
            break;
    }
    
    // Выводим результат
    comments.forEach(comment => console.log(comment));
    
    // Увеличиваем счетчик для букмекера и обновляем глобальный контекст
    counts[bookmaker] += 1;
    globalContext.lastBookmaker = bookmaker;
}

function processLogs(logString) {
    const lines = logString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const blocks = [];
    let currentBlock = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const type = classifyLine(line);
        
        if (isBlockSeparator(lines, i, currentBlock)) {
            // Завершаем текущий блок если он не пустой
            if (currentBlock.length > 0) {
                blocks.push(currentBlock);
                currentBlock = [];
            }
            
            // Пропускаем все последовательные разделители
            while (i < lines.length && classifyLine(lines[i]) === 'separator') {
                i++;
            }
            i--; // Компенсируем инкремент в цикле for
        } else {
            currentBlock.push({ line, type });
        }
    }
    
    // Добавляем последний блок если он не пустой
    if (currentBlock.length > 0) {
        blocks.push(currentBlock);
    }
    
    const counts = { 'bet365': 0, '1xbet': 0, 'CBet': 0, 'BMaker': 0 };
    const globalContext = { counts, lastBookmaker: null };
    
    for (const block of blocks) {
        processScenarioBlock(block, counts, globalContext);
    }
}

function parseLogs(logString) {
    const lines = logString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const oddsData = { 'bet365': {}, '1xbet': {}, 'CBet': {}, 'BMaker': {} };
    const counts = { 'bet365': 0, '1xbet': 0, 'CBet': 0, 'BMaker': 0 };
    const blocks = [];
    let currentBlock = [];
    
    // Разбиваем на блоки аналогично processLogs
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const type = classifyLine(line);
        
        if (isBlockSeparator(lines, i, currentBlock)) {
            if (currentBlock.length > 0) {
                blocks.push(currentBlock);
                currentBlock = [];
            }
            while (i < lines.length && classifyLine(lines[i]) === 'separator') {
                i++;
            }
            i--;
        } else {
            currentBlock.push({ line, type });
        }
    }
    
    if (currentBlock.length > 0) {
        blocks.push(currentBlock);
    }
    
    // Обрабатываем каждый блок
    const globalContext = { counts, lastBookmaker: null };
    for (const block of blocks) {
        parseMainBlock(block, oddsData, counts, globalContext);
    }
    
    return oddsData;
}

function parseMainBlock(block, oddsData, counts, globalContext) {
    let bookmaker = null;
    for (const { line, type } of block) {
        if (type === 'main_indicator') {
            bookmaker = getBookmaker(line);
            break;
        }
    }
    
    // Обработка блоков только с данными
    const scenarioType = detectScenarioType(block);
    if (scenarioType === 'data_only') {
        bookmaker = globalContext.lastBookmaker || '1xbet';
        const count = counts[bookmaker] || 0;
        const designationSet = designationSets[count % designationSets.length];
        
        let dataIndex = 0;
        for (const { line, type } of block) {
            if (type === 'data') {
                const designation = `live_${designationSet[dataIndex % 3]}_${bookmaker}`;
                const value = line.split('_').pop();
                oddsData[bookmaker][designation] = value;
                dataIndex++;
            }
        }
        return;
    }
    
    if (!bookmaker) return;
    
    const count = counts[bookmaker];
    const designationSet = designationSets[count % designationSets.length];
    
    // Группируем строки данных по мини-блокам (по 3 строки)
    const miniBlocks = [];
    let currentMiniBlock = [];
    
    for (const { line, type } of block) {
        if (type === 'data') {
            currentMiniBlock.push(line);
            if (currentMiniBlock.length === 3) {
                miniBlocks.push(currentMiniBlock);
                currentMiniBlock = [];
            }
        } else if (type === 'main_indicator' || type === 'additional_indicator') {
            if (currentMiniBlock.length > 0 && currentMiniBlock.length === 3) {
                miniBlocks.push(currentMiniBlock);
                currentMiniBlock = [];
            }
        }
    }
    
    if (currentMiniBlock.length === 3) {
        miniBlocks.push(currentMiniBlock);
    }
    
    // Определяем типы для мини-блоков
    let types = [];
    if (miniBlocks.length === 3) {
        types = ['old_', 'live_', 'new_'];
    } else if (miniBlocks.length === 2) {
        types = ['old_', 'new_'];
    } else if (miniBlocks.length === 1) {
        // Определяем тип на основе сценария
        if (scenarioType === 'D') {
            types = ['live_'];
        } else {
            types = ['old_'];
        }
    }
    
    // Записываем данные
    for (let i = 0; i < miniBlocks.length; i++) {
        const type = types[i];
        for (let j = 0; j < 3; j++) {
            const designation = `${type}${designationSet[j]}_${bookmaker}`;
            const value = miniBlocks[i][j].split('_').pop();
            oddsData[bookmaker][designation] = value;
        }
    }
    
    counts[bookmaker] += 1;
    globalContext.lastBookmaker = bookmaker;
}

module.exports = { processLogs, parseLogs };