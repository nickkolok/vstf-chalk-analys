'use strict';

var brights = [];

// Пороги яркости ПО УБЫВАНИЮ
// В принципе, нет разницы, как формировать массив
// В данном случае числа слева направо:
// максимальный порог яркости, минимальный порог яркости, шаг порога яркости
for(var b = 144; b >=8; b-=4){
	brights.push(b);
}

module.exports = {
	filename: "./images/test3-1.png", // На фиг не нужно
	step: 1, // Шаг прохода иголки. Можно потрогать, если скучно
	countNormals: true, // И это не трогать
	delta: 50, // Плечо линейной регрессии для нормалей. Не трогать.
	gaussRadius: 8, // Радиус размытия (не факт, что Гауссова). Не трогать.
	centersCacheEnabled: true, // Не трогать!!!
	brights:brights, // Магия
	writeSeparator: "\r\n", // Если не нравится, как выводит. Тут можно рисовать запятую.
	readSeparator: /\r*\n/g, // То же для ввода

	// С этим можно и нужно играться
	smoothDelta: 2, // Плечо линейно-регрессионного сглаживания перед расчётом расстояния между локальными максимумами. Имеет смысд от 1 до 10. Видно на фиолетовых и жёлтых точках
	inpeakAvgCoeff:8, // Коэффициент усреднения яркости вдоль нормали. Имеет смысл от 1 до сколько фантазии хватит.
	scaleFactor:1, // Коэффициент растяжения. До 8 имеет смысл. Лучше степень двойки. Если поставили не 1 - не забудьте результат на него разделить
	edgeDelta: 16, // Плечо сглаживания границы полоски.
	edgeThresholdCorrection: -20, // Поправка порога яркости для выделения полосы
	edgeCenterRadius: 2, // Ширина центровой полосы, по которой считается яркость. Осторожно, влияет на скорость работы! Квадратично!!!

	// Следующие два параметра отвечают за компромисс между скоростью и надёжностью.
	// Уменьшаем до 1 - увеличиваем надёжность.
	// Увеличиваем - увеличиваем скорость, но увеличиваем и риск падения программы из-за нехватки памяти
	concurrentDataWritings: 3, // Сколько текстовых файлов может записывать одновременно. Этот можно задирать сильно, они вроде маленькие
	concurrentImageWritings: 10, // То же для изображений. Увеличивать осторожно, а то упадёт от нехватки памяти
}
