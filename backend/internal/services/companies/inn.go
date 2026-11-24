package companies_service

// validINN checks the length, decimal digits and control digits.
// It does not confirm company existence or the representative's authority.
func validINN(value string) bool {
	if len(value) != 10 && len(value) != 12 {
		return false
	}
	nonzero := false
	for i := 0; i < len(value); i++ {
		if value[i] < '0' || value[i] > '9' {
			return false
		}
		nonzero = nonzero || value[i] != '0'
	}
	if !nonzero {
		return false
	}
	digit := func(weights []int) byte {
		sum := 0
		for i, w := range weights {
			sum += int(value[i]-'0') * w
		}
		return byte(sum%11%10) + '0'
	}
	if len(value) == 10 {
		return digit([]int{2, 4, 10, 3, 5, 9, 4, 6, 8}) == value[9]
	}
	return digit([]int{7, 2, 4, 10, 3, 5, 9, 4, 6, 8}) == value[10] &&
		digit([]int{3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8}) == value[11]
}
