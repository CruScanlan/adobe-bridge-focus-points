#!/usr/bin/perl
# Runs the bundled ExifTool on a system Perl (macOS, Linux).
#
# The Windows bundle in vendor/exiftool/exiftool_files already holds the whole
# pure-Perl ExifTool (exiftool.pl + lib/Image/ExifTool), next to a Windows-only
# Perl runtime. This puts that lib directory at the END of @INC, so the system
# Perl keeps its own core modules and only Image::ExifTool comes from the
# bundle, then runs the script. No second copy of ExifTool is shipped.
use strict;
use File::Basename qw(dirname);
use File::Spec;

my $files = File::Spec->catdir(dirname(File::Spec->rel2abs(__FILE__)),
                               '..', '..', 'vendor', 'exiftool', 'exiftool_files');
push @INC, File::Spec->catdir($files, 'lib');
my $script = File::Spec->catfile($files, 'exiftool.pl');
my $rc = do $script;
die "exiftool-unix.pl: cannot run $script: " . ($@ || $!) . "\n" unless defined $rc;
