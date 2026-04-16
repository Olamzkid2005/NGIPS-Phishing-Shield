#!/usr/bin/env python3
"""
Quick test of dataset loading functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from train_advanced_model import OnlineDatasetLoader

def test_datasets():
    """Test each dataset source individually"""
    loader = OnlineDatasetLoader()
    
    print("Testing individual dataset sources...")
    
    # Test PhishTank
    print("\n" + "="*50)
    df_phishtank = loader.download_phishtank_data()
    if df_phishtank is not None:
        print(f"PhishTank: {len(df_phishtank)} URLs loaded")
    
    # Test OpenPhish
    print("\n" + "="*50)
    df_openphish = loader.download_openphish_data()
    if df_openphish is not None:
        print(f"OpenPhish: {len(df_openphish)} URLs loaded")
    
    # Test URLhaus
    print("\n" + "="*50)
    df_urlhaus = loader.download_urlhaus_data()
    if df_urlhaus is not None:
        print(f"URLhaus: {len(df_urlhaus)} URLs loaded")
    
    # Test Phishing Army
    print("\n" + "="*50)
    df_phishing_army = loader.download_phishing_army_data()
    if df_phishing_army is not None:
        print(f"Phishing Army: {len(df_phishing_army)} URLs loaded")
    
    # Test MalwareBazaar
    print("\n" + "="*50)
    df_malware_bazaar = loader.download_malware_bazaar_data()
    if df_malware_bazaar is not None:
        print(f"MalwareBazaar: {len(df_malware_bazaar)} URLs loaded")
    
    # Test CyberCrime Tracker
    print("\n" + "="*50)
    df_cybercrime_tracker = loader.download_cybercrime_tracker_data()
    if df_cybercrime_tracker is not None:
        print(f"CyberCrime Tracker: {len(df_cybercrime_tracker)} URLs loaded")
    
    # Test local datasets
    print("\n" + "="*50)
    local_paths = [
        "../Dataset/phishing_site_urls.csv",
        "../Dataset/verified_online.csv", 
        "../Dataset/phishing_site_urls Combined.csv"
    ]
    
    for path in local_paths:
        df_local = loader.load_local_dataset(path)
        if df_local is not None:
            print(f"Local dataset {path}: {len(df_local)} URLs loaded")
    
    # Test legitimate URL generation
    print("\n" + "="*50)
    df_legitimate = loader.generate_legitimate_urls()
    print(f"Generated legitimate URLs: {len(df_legitimate)} URLs")
    
    print("\n" + "="*50)
    print("Dataset testing complete!")

if __name__ == "__main__":
    test_datasets()