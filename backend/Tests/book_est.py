#!/usr/bin/env python3
"""
Print Cost Calculator - Parent Sheets and Plates Calculation
Based on offset printing requirements with real-world considerations
"""

import math
from typing import Dict, List, Tuple, Optional

# ANSI color codes for terminal output
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'
    END = '\033[0m'

class PrintCalculator:
    def __init__(self):
        # Book sizes in mm
        self.book_sizes = {
            '1': {'name': 'A5', 'width': 148, 'height': 210},
            '2': {'name': 'A4', 'width': 210, 'height': 297},
            '3': {'name': 'B5', 'width': 176, 'height': 250},
            '4': {'name': 'B4', 'width': 250, 'height': 353},
            '5': {'name': 'Square', 'width': 210, 'height': 210},
            '6': {'name': 'Demy Quarto (8.75"×11.25")', 'width': 222, 'height': 286},
            '7': {'name': 'Demy Octavo (5.6"×8.75")', 'width': 142, 'height': 222}
        }
        
        # Parent sheet sizes in mm
        self.parent_sheets = {
            '1': {'name': 'Bank/Art Paper 24"×36" (609×914mm)', 'width': 609, 'height': 914},
            '2': {'name': 'Demy 17.5"×22.5" (445×572mm)', 'width': 445, 'height': 572}
        }
        
        # Paper thickness lookup table (GSM to mm)
        self.paper_thickness = {
            # Bank/Art paper thicknesses
            60: 0.08,
            70: 0.09,
            80: 0.10,
            100: 0.12,
            120: 0.14,
            # Demy paper thicknesses
            45: 0.06,
            55: 0.07
        }
        
        # Cover stock options
        self.cover_stocks = {
            '1': {'name': 'Art Board Large 25"×40"', 'width': 635, 'height': 1016},
            '2': {'name': 'Art Board Small 20"×25"', 'width': 508, 'height': 635},
            '3': {'name': 'Box Board 31"×43"', 'width': 787, 'height': 1092}
        }
        
        # Cover board thickness (for 250gsm)
        self.cover_board_thickness = 0.3  # mm
        
        # Wastage rules
        self.wastage_rules = [
            {'min': 100, 'max': 500, 'color': 0.15, 'bw': 0.10},
            {'min': 501, 'max': 1000, 'color': 0.10, 'bw': 0.07},
            {'min': 1001, 'max': 5000, 'color': 0.07, 'bw': 0.05},
            {'min': 5001, 'max': 10000, 'color': 0.05, 'bw': 0.03},
            {'min': 10001, 'max': float('inf'), 'color': 0.03, 'bw': 0.02}
        ]
        
        self.makeready_waste = {
            'bw': 100,
            'two_color': 150,
            'color': 200
        }
        
        # Press sheet sizes (what actually fits on press)
        self.press_sheets = {
            'bank_art': {'name': '18"×24"', 'width': 457, 'height': 609},  # Half of parent sheet
            'demy': {'name': '17.5"×22.5"', 'width': 445, 'height': 572}   # Full demy
        }
        
    def calculate_imposition(self, book_w: int, book_h: int, sheet_w: int, sheet_h: int, 
                           collation_method: str = 'standard') -> int:
        """Calculate how many book pages fit on one parent sheet (both sides)"""
        if collation_method == 'fold':
            # For fold & collate, use standard signatures (multiples of 4)
            # Common signature sizes: 8, 16, 32 pages
            portrait_fit = (sheet_w // book_w) * (sheet_h // book_h)
            landscape_fit = (sheet_w // book_h) * (sheet_h // book_w)
            pages_per_side = max(portrait_fit, landscape_fit)
            
            # Round down to nearest signature size (4 or 8)
            if pages_per_side >= 8:
                pages_per_side = 8
            elif pages_per_side >= 4:
                pages_per_side = 4
            else:
                pages_per_side = 2
                
            return pages_per_side * 2
        else:
            # Standard calculation for cut & collate
            portrait_fit = (sheet_w // book_w) * (sheet_h // book_h)
            landscape_fit = (sheet_w // book_h) * (sheet_h // book_w)
            pages_per_sheet = max(portrait_fit, landscape_fit) * 2
            return pages_per_sheet
    
    def calculate_spine_width(self, pages: int, paper_gsm: int) -> float:
        """Calculate book spine width based on pages and paper thickness"""
        # Get paper thickness from GSM
        paper_thickness = self.paper_thickness.get(paper_gsm, 0.10)  # Default to 0.10mm
        
        # Calculate spine: (pages/2) × thickness + cover thickness + binding allowance
        sheets = pages / 2
        spine_width = (sheets * paper_thickness) + self.cover_board_thickness + 2  # 2mm for glue/binding
        
        return round(spine_width, 1)
    
    def calculate_cover_size(self, book_size: Dict, spine_width: float, bleed: int = 3) -> Dict:
        """Calculate full cover dimensions including spine and bleeds"""
        # Cover width = Front + Back + Spine + 4 bleeds
        cover_width = (2 * book_size['width']) + spine_width + (4 * bleed)
        
        # Cover height = Book height + 2 bleeds
        cover_height = book_size['height'] + (2 * bleed)
        
        return {
            'width': round(cover_width),
            'height': round(cover_height),
            'spine': spine_width
        }
    
    def calculate_cover_imposition(self, cover_size: Dict, stock_size: Dict, 
                                 quantity: int, press_sheet: Dict) -> Dict:
        """Calculate cover imposition - check for 1-up or 2-up possibilities"""
        # Standard imposition calculation
        portrait_fit = (stock_size['width'] // cover_size['width']) * (stock_size['height'] // cover_size['height'])
        landscape_fit = (stock_size['width'] // cover_size['height']) * (stock_size['height'] // cover_size['width'])
        covers_per_sheet = max(portrait_fit, landscape_fit)
        
        # Check if 2-up is possible on press sheet for large quantities
        use_two_up = False
        if quantity >= 5000:
            # Account for gripper (10mm on long edge)
            press_width = press_sheet['width'] - 10
            press_height = press_sheet['height']
            
            # Check if 2 covers fit on press sheet
            portrait_2up = (press_width // cover_size['width']) * (press_height // cover_size['height'])
            landscape_2up = (press_width // cover_size['height']) * (press_height // cover_size['width'])
            
            if max(portrait_2up, landscape_2up) >= 2:
                use_two_up = True
        
        return {
            'covers_per_sheet': covers_per_sheet,
            'use_two_up': use_two_up,
            'ups_per_plate': 2 if use_two_up else 1
        }
    
    def calculate_impressions(self, total_plates: int, quantity: int, buffer_plates: int = 0) -> Dict:
        """Calculate printing impressions based on plates and quantity"""
        # Each plate runs for the full quantity, counted in units of 1000
        impression_units = math.ceil(quantity / 1000)
        base_impressions = (total_plates - buffer_plates) * impression_units
        buffer_impressions = buffer_plates * impression_units
        total_impressions = base_impressions + buffer_impressions
        
        return {
            'impression_units': impression_units,
            'base_impressions': base_impressions,
            'buffer_impressions': buffer_impressions,
            'total_impressions': total_impressions
        }
    
    def calculate_wastage(self, quantity: int, job_type: str) -> Dict:
        """Calculate wastage based on quantity and job type - all inclusive"""
        # Calculate base waste percentage using real-world formula (for full color)
        if quantity <= 1000:
            # Formula: 110 / (Quantity / 100)
            # This gives us: 100->110%, 200->55%, 500->22%, 1000->11%
            base_waste_percent = 110 / (quantity / 100)
            base_waste_percent = base_waste_percent / 100  # Convert to decimal
        else:
            # Fixed percentages for larger quantities
            if quantity <= 1500:
                base_waste_percent = 0.093  # 9.3%
            elif quantity <= 2000:
                base_waste_percent = 0.075  # 7.5%
            elif quantity <= 3000:
                base_waste_percent = 0.06   # 6%
            elif quantity <= 5000:
                base_waste_percent = 0.042  # 4.2%
            elif quantity <= 10000:
                base_waste_percent = 0.035  # 3.5%
            else:
                base_waste_percent = 0.03   # 3%
        
        # Apply job type multipliers
        if job_type == 'bw':
            waste_multiplier = 0.55  # B/W jobs have ~55% of color wastage
        elif job_type == 'two_color':
            waste_multiplier = 0.73  # 2-color jobs have ~73% of color wastage
        else:  # full color
            waste_multiplier = 1.0   # Full color uses base wastage
        
        # Calculate final waste percentage
        final_waste_percent = base_waste_percent * waste_multiplier
        
        # Calculate total waste (includes makeready + run waste)
        total_waste = math.ceil(quantity * final_waste_percent)
        
        return {
            'makeready': 0,  # Not separated anymore
            'run_waste': total_waste,  # All waste combined
            'total_waste': total_waste,
            'total_quantity': quantity + total_waste
        }
    
    def calculate_parent_sheets(self, book_size: Dict, pages: int, quantity: int, 
                              parent_sheet: Dict, wastage: int, collation_method: str = 'standard') -> Dict:
        """Calculate parent sheets needed"""
        # Calculate imposition
        imposition = self.calculate_imposition(
            book_size['width'], book_size['height'],
            parent_sheet['width'], parent_sheet['height'],
            collation_method
        )
        
        # Sheets per book - allow quarters (0.25) and halves (0.50)
        exact_sheets = pages / imposition
        # Round to nearest 0.25
        sheets_per_book = math.ceil(exact_sheets * 4) / 4
        
        # Total parent sheets
        total_quantity = quantity + wastage
        total_parent_sheets = math.ceil(sheets_per_book * total_quantity)
        
        # Calculate efficiency
        actual_pages = sheets_per_book * imposition
        efficiency = (pages / actual_pages) * 100 if actual_pages > 0 else 0
        
        return {
            'imposition': imposition,
            'sheets_per_book': sheets_per_book,
            'total_quantity': total_quantity,
            'total_parent_sheets': total_parent_sheets,
            'efficiency': round(efficiency, 1)
        }
    
    def calculate_plates(self, color_pages: int, two_color_pages: int, bw_pages: int, 
                        book_size: Dict, parent_sheet_name: str, 
                        collation_method: str = 'standard', scattered: bool = True) -> Dict:
        """Calculate plates needed based on press sheet capacity"""
        # Determine press sheet to use
        if 'Bank' in parent_sheet_name:
            press_sheet = self.press_sheets['bank_art']
        else:
            press_sheet = self.press_sheets['demy']
        
        # Calculate pages per plate based on press sheet
        # Special case: B5 with Cut & Collate on Bank/Art paper press sheet
        if (book_size['name'] == 'B5' and 
            collation_method == 'standard' and  # standard = cut & collate
            'Bank' in parent_sheet_name):
            # Manual imposition allows 5 pages (3 portrait + 2 landscape)
            pages_per_plate = 5
        else:
            # Standard calculation for other cases
            portrait_fit = (press_sheet['width'] // book_size['width']) * (press_sheet['height'] // book_size['height'])
            landscape_fit = (press_sheet['width'] // book_size['height']) * (press_sheet['height'] // book_size['width'])
            pages_per_plate = max(portrait_fit, landscape_fit)
            
            # For fold & collate, limit to signature sizes
            if collation_method == 'fold':
                if pages_per_plate >= 8:
                    pages_per_plate = 8
                elif pages_per_plate >= 4:
                    pages_per_plate = 4
                else:
                    pages_per_plate = 2
        
        # Ensure minimum of 1 page per plate
        pages_per_plate = max(1, pages_per_plate)
        
        # Base calculations
        color_plates_base = math.ceil(color_pages / pages_per_plate) * 4 if color_pages > 0 else 0  # CMYK
        two_color_plates_base = math.ceil(two_color_pages / pages_per_plate) * 2 if two_color_pages > 0 else 0  # 2 colors
        bw_plates_base = math.ceil(bw_pages / pages_per_plate) if bw_pages > 0 else 0
        
        # Calculate buffers for scattered pages
        color_buffer = 0
        two_color_buffer = 0
        
        if scattered:
            # 4-color buffer: default 2 sets (8 plates) + 1 set per 16 plates
            if color_pages > 0:
                default_buffer = 8  # 2 sets × 4 colors
                additional_sets = color_plates_base // 16  # 1 set per 16 plates
                color_buffer = default_buffer + (additional_sets * 4)
            
            # 2-color buffer: default 2 sets (4 plates) + 1 set per 16 plates
            if two_color_pages > 0:
                default_buffer = 4  # 2 sets × 2 colors
                additional_sets = two_color_plates_base // 16  # 1 set per 16 plates
                two_color_buffer = default_buffer + (additional_sets * 2)
        
        # B/W buffer remains simple
        bw_buffer = 3 if bw_pages > 0 else 0
        
        return {
            'pages_per_plate': pages_per_plate,
            'color_plates_base': color_plates_base,
            'color_plates_buffer': color_buffer,
            'color_plates_total': color_plates_base + color_buffer,
            'two_color_plates_base': two_color_plates_base,
            'two_color_plates_buffer': two_color_buffer,
            'two_color_plates_total': two_color_plates_base + two_color_buffer,
            'bw_plates_base': bw_plates_base,
            'bw_plates_buffer': bw_buffer,
            'bw_plates_total': bw_plates_base + bw_buffer,
            'total_plates': (color_plates_base + color_buffer + 
                           two_color_plates_base + two_color_buffer + 
                           bw_plates_base + bw_buffer),
            'scattered': scattered
        }
    
    def get_user_input(self):
        """Get input from user"""
        print("\n=== PRINT COST CALCULATOR ===\n")
        
        # Book size
        print("Select book size:")
        for key, size in self.book_sizes.items():
            print(f"{key}. {size['name']} ({size['width']}×{size['height']}mm)")
        book_choice = input("\nEnter choice (1-7): ")
        book_size = self.book_sizes.get(book_choice, self.book_sizes['2'])
        
        # Quantities
        print("\nEnter quantities (comma-separated, e.g., 500,1000,2000):")
        quantities_input = input("Quantities: ")
        quantities = [int(q.strip()) for q in quantities_input.split(',')]
        
        # Parent sheet
        print("\nSelect parent sheet size:")
        for key, sheet in self.parent_sheets.items():
            print(f"{key}. {sheet['name']}")
        sheet_choice = input("\nEnter choice (1-2): ")
        parent_sheet = self.parent_sheets.get(sheet_choice, self.parent_sheets['1'])
        
        # Pages
        total_pages = int(input("\nTotal number of pages: "))
        color_pages = int(input("Number of 4-color (CMYK) pages: "))
        two_color_pages = int(input("Number of 2-color pages: "))
        bw_pages = total_pages - color_pages - two_color_pages
        
        # Validate page count
        if bw_pages < 0:
            print("\nError: Color pages exceed total pages!")
            return None
        
        # Collation method - ask only for mixed colors or B5
        collation_method = 'fold'  # Default to fold & collate
        
        # Check if we have mixed colors
        has_mixed_colors = sum([color_pages > 0, two_color_pages > 0, bw_pages > 0]) > 1
        
        if book_size['name'] == 'B5':
            print("\nSelect collation method for B5:")
            print("1. Cut & Collate (20 pages per sheet)")
            print("2. Fold & Collate (16 pages per sheet)")
            collation_choice = input("\nEnter choice (1-2): ")
            if collation_choice == '1':
                collation_method = 'standard'  # Cut & collate
        elif has_mixed_colors:
            print("\nThis book has mixed color pages. Select production method:")
            print("1. Cut & Collate (for scattered colors)")
            print("2. Fold & Collate (for grouped color sections)")
            collation_choice = input("\nEnter choice (1-2): ")
            if collation_choice == '1':
                collation_method = 'standard'  # Cut & collate
        
        # Scattered pages - only relevant for mixed colors
        scattered = False
        if has_mixed_colors and collation_method == 'standard':
            scattered = True  # Cut & collate implies scattered
        
        # Paper GSM for spine calculation
        print("\nSelect inside paper GSM:")
        if 'Demy' in book_size['name']:
            print("1. 45 GSM")
            print("2. 55 GSM")
            gsm_choice = input("Enter choice (1-2): ")
            paper_gsm = 45 if gsm_choice == '1' else 55
        else:
            print("1. 60 GSM")
            print("2. 70 GSM")
            print("3. 80 GSM")
            print("4. 100 GSM")
            print("5. 120 GSM")
            gsm_choice = input("Enter choice (1-5): ")
            gsm_map = {'1': 60, '2': 70, '3': 80, '4': 100, '5': 120}
            paper_gsm = gsm_map.get(gsm_choice, 80)
        
        # Cover specifications
        print("\nCOVER SPECIFICATIONS")
        print("\nSelect cover stock:")
        for key, stock in self.cover_stocks.items():
            print(f"{key}. {stock['name']}")
        cover_stock_choice = input("Enter choice (1-3): ")
        cover_stock = self.cover_stocks.get(cover_stock_choice, self.cover_stocks['1'])
        
        # Cover colors
        print("\nNumber of colors on cover (front only):")
        print("1. Single color")
        print("2. Two colors")
        print("3. Four colors (CMYK)")
        cover_color_choice = input("Enter choice (1-3): ")
        cover_colors = int(cover_color_choice) if cover_color_choice in ['1', '2'] else 4
        
        # Cover lamination
        print("\nIs cover laminated?")
        print("1. Gloss Laminated")
        print("2. Matt Laminated")
        print("3. Not Laminated")
        lamination_choice = input("Enter choice (1-3): ")
        lamination_type = {
            '1': 'Gloss',
            '2': 'Matt',
            '3': 'None'
        }.get(lamination_choice, 'None')
        
        return {
            'book_size': book_size,
            'quantities': quantities,
            'parent_sheet': parent_sheet,
            'total_pages': total_pages,
            'color_pages': color_pages,
            'two_color_pages': two_color_pages,
            'bw_pages': bw_pages,
            'scattered': scattered,
            'collation_method': collation_method,
            'paper_gsm': paper_gsm,
            'cover_stock': cover_stock,
            'cover_colors': cover_colors,
            'lamination_type': lamination_type
        }
    
    def print_results(self, inputs: Dict, results: List[Dict]):
        """Print calculation results"""
        print(f"\n{Colors.BOLD}{Colors.HEADER}{'='*60}")
        print("CALCULATION RESULTS")
        print(f"{'='*60}{Colors.END}")
        
        print(f"\n{Colors.BOLD}Book Specifications:{Colors.END}")
        print(f"- Size: {Colors.CYAN}{inputs['book_size']['name']} ({inputs['book_size']['width']}×{inputs['book_size']['height']}mm){Colors.END}")
        print(f"- Total Pages: {inputs['total_pages']}")
        print(f"- 4-Color Pages: {inputs['color_pages']}")
        print(f"- 2-Color Pages: {inputs['two_color_pages']}")
        print(f"- B/W Pages: {inputs['bw_pages']}")
        print(f"- Parent Sheet: {inputs['parent_sheet']['name']}")
        
        # Show production method
        if inputs.get('collation_method') == 'standard':
            print(f"- Production Method: {Colors.YELLOW}Cut & Collate{Colors.END}")
        else:
            print(f"- Production Method: {Colors.GREEN}Fold & Collate{Colors.END}")
            
        print(f"\n{Colors.BOLD}Cover Specifications:{Colors.END}")
        print(f"- Cover Stock: {inputs['cover_stock']['name']}")
        print(f"- Cover Colors: {inputs['cover_colors']}")
        print(f"- Cover Lamination: {inputs['lamination_type']}")
        print(f"- Paper GSM: {inputs['paper_gsm']}")
        
        for i, result in enumerate(results):
            qty = result['quantity']
            sheets = result['sheets']
            plates = result['plates']
            wastage = result['wastage']
            
            print(f"\n{Colors.BOLD}{Colors.BLUE}--- Quantity: {qty:,} books ---{Colors.END}")
            
            print(f"\n{Colors.BOLD}Wastage Calculation:{Colors.END}")
            print(f"  Makeready: {wastage['makeready']} books")
            print(f"  Run Waste: {wastage['run_waste']} books")
            print(f"  Total Waste: {Colors.YELLOW}{wastage['total_waste']} books{Colors.END}")
            print(f"  Total to Print: {Colors.GREEN}{wastage['total_quantity']:,} books{Colors.END}")
            
            print(f"\n{Colors.BOLD}Parent Sheets:{Colors.END}")
            print(f"  Pages per Sheet: {sheets['imposition']} ({sheets['imposition']//2} per side)")
            print(f"  Sheets per Book: {sheets['sheets_per_book']}")
            print(f"  Total Parent Sheets: {Colors.GREEN}{sheets['total_parent_sheets']:,}{Colors.END}")
            print(f"  Paper Efficiency: {sheets['efficiency']}%")
            
            print(f"\n{Colors.BOLD}Plates Required{Colors.END} (based on press sheet {plates['pages_per_plate']} pages per plate):")
            if plates['color_plates_total'] > 0:
                print(f"  4-Color Plates: {plates['color_plates_base']}")
                if plates['color_plates_buffer'] > 0:
                    print(f"    + Buffer: {plates['color_plates_buffer']}")
                print(f"    = Total: {Colors.CYAN}{plates['color_plates_total']}{Colors.END}")
            
            if plates['two_color_plates_total'] > 0:
                print(f"  2-Color Plates: {plates['two_color_plates_base']}")
                if plates['two_color_plates_buffer'] > 0:
                    print(f"    + Buffer: {plates['two_color_plates_buffer']}")
                print(f"    = Total: {Colors.CYAN}{plates['two_color_plates_total']}{Colors.END}")
            
            if plates['bw_plates_total'] > 0:
                print(f"  B/W Plates: {plates['bw_plates_base']}")
                if plates['bw_plates_buffer'] > 0:
                    print(f"    + Buffer: {plates['bw_plates_buffer']}")
                print(f"    = Total: {Colors.CYAN}{plates['bw_plates_total']}{Colors.END}")
            
            print(f"  {Colors.BOLD}TOTAL PLATES: {Colors.GREEN}{plates['total_plates']}{Colors.END}")
            
            print(f"\n{Colors.BOLD}Printing Impressions:{Colors.END}")
            print(f"  Impression Units (per 1000): {result['impressions']['impression_units']}")
            print(f"  Total Impressions: {Colors.GREEN}{result['impressions']['total_impressions']:,}{Colors.END}")
            if result['impressions']['buffer_impressions'] > 0:
                print(f"    (includes {result['impressions']['buffer_impressions']} buffer impressions)")
            
            # Cover calculations
            print(f"\n{Colors.BOLD}{Colors.HEADER}--- COVER CALCULATIONS ---{Colors.END}")
            print(f"\nSpine Width: {Colors.YELLOW}{result['spine_width']}mm{Colors.END}")
            print(f"Cover Size: {Colors.CYAN}{result['cover']['size']['width']}mm × {result['cover']['size']['height']}mm{Colors.END}")
            print(f"  (Front + {result['cover']['size']['spine']}mm spine + Back + bleeds)")
            
            print(f"\n{Colors.BOLD}Cover Production:{Colors.END}")
            print(f"  Covers per Sheet: {result['cover']['imposition']['covers_per_sheet']}")
            if result['cover']['imposition']['use_two_up']:
                print(f"  Press Layout: {Colors.GREEN}2-up (reduced impressions){Colors.END}")
            else:
                print(f"  Press Layout: 1-up")
            print(f"  Cover Wastage: {result['cover']['wastage']['total_waste']} covers")
            print(f"  Total to Print: {Colors.GREEN}{result['cover']['wastage']['total_quantity']:,} covers{Colors.END}")
            print(f"  Total Cover Sheets: {Colors.GREEN}{result['cover']['sheets']:,}{Colors.END}")
            
            print(f"\n{Colors.BOLD}Cover Plates & Impressions:{Colors.END}")
            print(f"  Cover Plates: {Colors.CYAN}{result['cover']['plates']}{Colors.END} ({inputs['cover_colors']} colors)")
            print(f"  Cover Impressions: {Colors.GREEN}{result['cover']['impressions']:,}{Colors.END}")
            
            if inputs['lamination_type'] != 'None':
                print(f"\n{Colors.BOLD}Lamination ({inputs['lamination_type']}):{Colors.END}")
                print(f"  Total Surface Area: {Colors.YELLOW}{result['cover']['lamination_sqin']:,.0f} square inches{Colors.END}")
                print(f"  ({result['cover']['wastage']['total_quantity']} covers × {result['cover']['lamination_sqin']/result['cover']['wastage']['total_quantity']:.1f} sq.in. each)")
    
    def run(self):
        """Main execution"""
        try:
            # Get user input
            inputs = self.get_user_input()
            if not inputs:
                return
            
            # Calculate for each quantity
            results = []
            for quantity in inputs['quantities']:
                # Check minimum quantity
                if quantity < 100:
                    print(f"\nWarning: Quantity {quantity} is below minimum (100) for offset printing")
                    continue
                
                # Determine job type for wastage calculation
                if inputs['color_pages'] > 0:
                    job_type = 'color'
                elif inputs['two_color_pages'] > 0:
                    job_type = 'two_color'
                else:
                    job_type = 'bw'
                
                # Calculate wastage
                wastage = self.calculate_wastage(quantity, job_type)
                
                # Calculate parent sheets
                sheets = self.calculate_parent_sheets(
                    inputs['book_size'],
                    inputs['total_pages'],
                    quantity,
                    inputs['parent_sheet'],
                    wastage['total_waste'],
                    inputs.get('collation_method', 'standard')
                )
                
                # Calculate plates
                plates = self.calculate_plates(
                    inputs['color_pages'],
                    inputs['two_color_pages'],
                    inputs['bw_pages'],
                    inputs['book_size'],
                    inputs['parent_sheet']['name'],
                    inputs.get('collation_method', 'standard'),
                    scattered=inputs['scattered']
                )
                
                # Calculate impressions
                total_buffer_plates = (plates['color_plates_buffer'] + 
                                     plates['two_color_plates_buffer'] + 
                                     plates['bw_plates_buffer'])
                impressions = self.calculate_impressions(
                    plates['total_plates'],
                    quantity,
                    total_buffer_plates
                )
                
                # Calculate spine width
                spine_width = self.calculate_spine_width(
                    inputs['total_pages'],
                    inputs['paper_gsm']
                )
                
                # Calculate cover size
                cover_size = self.calculate_cover_size(
                    inputs['book_size'],
                    spine_width
                )
                
                # Calculate cover imposition
                cover_imposition = self.calculate_cover_imposition(
                    cover_size,
                    inputs['cover_stock'],
                    quantity,
                    self.press_sheets['bank_art']  # Using standard press sheet
                )
                
                # Calculate cover sheets needed
                cover_waste_multiplier = 1.36  # 36% more than inside pages (15% vs 11% at 1000 qty)
                cover_wastage = self.calculate_wastage(quantity, 'color')  # Use color wastage as base
                cover_wastage['total_waste'] = math.ceil(cover_wastage['total_waste'] * cover_waste_multiplier)
                cover_wastage['total_quantity'] = quantity + cover_wastage['total_waste']
                
                covers_per_sheet = cover_imposition['covers_per_sheet']
                total_cover_sheets = math.ceil(cover_wastage['total_quantity'] / covers_per_sheet)
                
                # Calculate cover plates
                ups_per_plate = cover_imposition['ups_per_plate']
                cover_plates = math.ceil(1 / ups_per_plate) * inputs['cover_colors']  # 1 set of plates
                cover_plates_total = cover_plates  # No buffer for covers
                
                # Calculate cover impressions
                cover_impression_units = math.ceil(quantity / 1000)
                cover_impressions = cover_plates_total * cover_impression_units
                
                # Calculate lamination surface area (if laminated)
                lamination_sqin = 0
                if inputs['lamination_type'] != 'None':
                    # Convert cover size from mm to inches (1 inch = 25.4mm)
                    cover_width_inches = cover_size['width'] / 25.4
                    cover_height_inches = cover_size['height'] / 25.4
                    
                    # Calculate surface area per cover (front only)
                    area_per_cover = cover_width_inches * cover_height_inches
                    
                    # Total lamination area for all covers to be printed
                    lamination_sqin = area_per_cover * cover_wastage['total_quantity']
                
                results.append({
                    'quantity': quantity,
                    'wastage': wastage,
                    'sheets': sheets,
                    'plates': plates,
                    'impressions': impressions,
                    'spine_width': spine_width,
                    'cover': {
                        'size': cover_size,
                        'imposition': cover_imposition,
                        'wastage': cover_wastage,
                        'sheets': total_cover_sheets,
                        'plates': cover_plates_total,
                        'impressions': cover_impressions,
                        'lamination_sqin': lamination_sqin
                    }
                })
            
            # Print results
            if results:
                self.print_results(inputs, results)
            
        except ValueError as e:
            print(f"\nError: Invalid input. Please enter numbers where required.")
        except Exception as e:
            print(f"\nError: {str(e)}")

if __name__ == "__main__":
    calculator = PrintCalculator()
    calculator.run()